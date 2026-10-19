import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import * as QRCode from 'qrcode';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import { FinishedUnit } from '../../entities/finished-unit.entity';
import {
  KitchenProductionBatch,
  KitchenMealPlan,
  StockMovement,
  StockLot,
  Stock,
  Product,
} from '../../entities';
import { StockTraceService } from '../stock-trace/stock-trace.service';
import { resolveStockBranch } from '../stock/stock-scope';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';
import { traceStatus } from './production-trace.rules';

@ApiTags('Production traceability')
@ApiBearerAuth()
@Controller('production-trace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN, UserType.CASHIER)
export class ProductionTraceController {
  constructor(
    private db: DataSource,
    private trace: StockTraceService,
  ) {}

  private async batch(actor: any, id: string) {
    const batch = await this.db
      .getRepository(KitchenProductionBatch)
      .findOneBy({ id });
    if (!batch) throw new NotFoundException('BATCH_NOT_FOUND');
    const plan = await this.db
      .getRepository(KitchenMealPlan)
      .findOneByOrFail({ id: batch.mealPlanId });
    resolveStockBranch(actor, plan.branchId);
    return { batch, plan };
  }

  @Get('lots/:id')
  @ApiOperation({ summary: 'Raw material/fuel lot status and complete origin' })
  async lot(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const lot = await this.db.getRepository(StockLot).findOneBy({ id });
    if (!lot) throw new NotFoundException('LOT_NOT_FOUND');
    const stock = await this.db
      .getRepository(Stock)
      .findOneByOrFail({ id: lot.stockId });
    resolveStockBranch(req.user, stock.branchId);
    return {
      status: traceStatus('LOT', '', lot.expiresAt),
      trace: await this.trace.getFullTrace({ lotId: id }),
    };
  }

  @Get('batches/:id')
  @ApiOperation({
    summary: 'Batch status, actual input lots, quantities and supplier origins',
  })
  async detail(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const { batch, plan } = await this.batch(req.user, id);
    const movements = await this.db
      .getRepository(StockMovement)
      .createQueryBuilder('m')
      .where('m.reference_id=:id AND m.quantity<0 AND m.lot_id IS NOT NULL', {
        id,
      })
      .getMany();
    const origins = new Map<string, any>();
    for (const move of movements) {
      if (!origins.has(move.lotId!))
        origins.set(
          move.lotId!,
          await this.trace.getFullTrace({ lotId: move.lotId! }),
        );
    }
    return {
      batchId: id,
      productId: batch.productId,
      branchId: plan.branchId,
      product: await this.db
        .getRepository(Product)
        .findOneBy({ id: batch.productId }),
      status: traceStatus(
        'BATCH',
        batch.status,
        batch.details.servingExpiresAt,
      ),
      productionStatus: batch.status,
      actualQuantity: batch.actualQuantity,
      startedAt: batch.startedAt,
      readyAt: batch.readyAt,
      completedAt: batch.completedAt,
      expiresAt: batch.details.servingExpiresAt || null,
      traceabilityComplete: batch.details.traceabilityVersion === 1,
      inputs: movements.map((m) => ({
        lotId: m.lotId,
        consumedQuantity: -Number(m.quantity),
        origin: origins.get(m.lotId!),
      })),
    };
  }

  @Get('batches/:id/labels')
  @ApiOperation({
    summary: 'Paginated stable per-portion QR labels for printing',
  })
  async labels(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: any,
  ) {
    const { batch } = await this.batch(req.user, id);
    const p = normalizePagination(q.page, q.size);
    p.page = Math.floor(p.page);
    p.size = Math.min(100, Math.floor(p.size));
    p.skip = (p.page - 1) * p.size;
    const [units, total] = await this.db
      .getRepository(FinishedUnit)
      .findAndCount({
        where: { batchId: id },
        order: { serial: 'ASC' },
        skip: p.skip,
        take: p.size,
      });
    const product = await this.db
      .getRepository(Product)
      .findOneBy({ id: batch.productId });
    const labels = await Promise.all(
      units.map(async (unit) => {
        const path = `/production-trace/units/${unit.id}`;
        // Configure an absolute FE scanner URL for phone scanning, e.g. https://host/trace?unitId=
        const payload = process.env.TRACE_QR_BASE_URL
          ? `${process.env.TRACE_QR_BASE_URL}${encodeURIComponent(unit.id)}`
          : `MBH:UNIT:${unit.id}`;
        return {
          unitId: unit.id,
          serial: unit.serial,
          batchId: id,
          productId: unit.productId,
          productName: product?.name,
          producedAt: batch.completedAt,
          expiresAt: unit.expiresAt,
          status: traceStatus('UNIT', batch.status, unit.expiresAt),
          tracePath: path,
          qrPayload: payload,
          qrSvg: await QRCode.toString(payload, {
            type: 'svg',
            errorCorrectionLevel: 'M',
          }),
        };
      }),
    );
    return toPaginationResponse(labels, total, p.page, p.size);
  }

  @Get('units/:id')
  @ApiOperation({
    summary:
      'Scan a single finished portion and trace its batch back to supplier lots',
  })
  async unit(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const unit = await this.db.getRepository(FinishedUnit).findOneBy({ id });
    if (!unit) throw new NotFoundException('FINISHED_UNIT_NOT_FOUND');
    resolveStockBranch(req.user, unit.branchId);
    const batch = await this.detail(req, unit.batchId);
    return {
      unitId: unit.id,
      serial: unit.serial,
      expiresAt: unit.expiresAt,
      status: traceStatus('UNIT', batch.productionStatus, unit.expiresAt),
      batch,
    };
  }
}
