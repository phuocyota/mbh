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
import { DataSource, In } from 'typeorm';
import { isUUID } from 'class-validator';
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
  Order,
  OrderItem,
  KitchenOrderTicket,
  KitchenOperation,
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

  @Get('orders/:orderId/products/:productId')
  @ApiOperation({
    summary:
      'Production batches belonging to a product in this order, including split production rounds',
  })
  async orderProduct(
    @Req() req: any,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() q: any,
  ) {
    const order = await this.db.getRepository(Order).findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    resolveStockBranch(req.user, order.branchId);
    const items = await this.db
      .getRepository(OrderItem)
      .findBy({ orderId, productId });
    if (!items.length)
      throw new NotFoundException('Sản phẩm không thuộc đơn hàng này.');
    const p = normalizePagination(q.page, q.size);
    p.page = Math.min(1000000, Math.floor(p.page));
    p.size = Math.min(50, Math.floor(p.size));
    p.skip = (p.page - 1) * p.size;
    const ticket = await this.db
      .getRepository(KitchenOrderTicket)
      .findOneBy({ orderId, branchId: order.branchId });
    let batches: KitchenProductionBatch[] = [],
      total = 0;
    if (ticket) {
      const flow = await this.db.getRepository(KitchenOperation).findOneBy({
        branchId: order.branchId,
        kind: 'task-flow',
        parentId: ticket.id,
      });
      const payload = flow?.payload || {};
      const list = (value: any) => (Array.isArray(value) ? value : []);
      const ids = [
        ...new Set(
          [
            ...list(payload.batchIds),
            ...list(payload.received).map((row: any) => row.batchId),
            ...list(payload.rounds).flatMap((round: any) =>
              list(round.received).map((row: any) => row.batchId),
            ),
          ].filter((id: unknown) => typeof id === 'string' && isUUID(id)),
        ),
      ];
      const query = this.db
        .getRepository(KitchenProductionBatch)
        .createQueryBuilder('b')
        .innerJoin(KitchenMealPlan, 'p', 'p.id=b.meal_plan_id')
        .where('p.branch_id=:branchId AND b.product_id=:productId', {
          branchId: order.branchId,
          productId,
        })
        .andWhere(
          "(b.details->>'workflowTicketId'=:ticketId OR b.id=ANY(:ids::uuid[]))",
          { ticketId: ticket.id, ids },
        );
      [batches, total] = await query
        .orderBy('b.createdAt', 'ASC')
        .addOrderBy('b.id', 'ASC')
        .skip(p.skip)
        .take(p.size)
        .getManyAndCount();
    }
    const counts = batches.length
      ? await this.db
          .getRepository(FinishedUnit)
          .createQueryBuilder('u')
          .select('u.batchId', 'batchId')
          .addSelect('COUNT(*)', 'quantity')
          .where({
            branchId: order.branchId,
            productId,
            batchId: In(batches.map((b) => b.id)),
          })
          .groupBy('u.batchId')
          .getRawMany()
      : [];
    return {
      orderId,
      orderNumber: order.orderNumber,
      productId,
      productName: items[0].productName,
      orderedQuantity: items.reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
      ),
      ticketStatus: ticket?.status || null,
      batches: toPaginationResponse(
        batches.map((batch) => ({
          batchId: batch.id,
          productionStatus: batch.status,
          plannedQuantity:
            Number(batch.plannedQuantity) + Number(batch.adjustmentQuantity),
          actualQuantity:
            batch.actualQuantity == null ? null : Number(batch.actualQuantity),
          unitCount: Number(
            counts.find((row: any) => row.batchId === batch.id)?.quantity || 0,
          ),
          completedAt: batch.completedAt,
          expiresAt: batch.details.servingExpiresAt || null,
          traceabilityComplete: batch.details.traceabilityVersion === 1,
        })),
        total,
        p.page,
        p.size,
      ),
    };
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
      .where('m.reference_id=:id AND m.lot_id IS NOT NULL', {
        id,
      })
      .getMany();
    const inputs = new Map<
      string,
      { lotId: string; issuedQuantity: number; returnedQuantity: number }
    >();
    for (const move of movements) {
      const input = inputs.get(move.lotId!) || {
        lotId: move.lotId!,
        issuedQuantity: 0,
        returnedQuantity: 0,
      };
      if (Number(move.quantity) < 0)
        input.issuedQuantity += -Number(move.quantity);
      else input.returnedQuantity += Number(move.quantity);
      inputs.set(move.lotId!, input);
    }
    const consumedInputs = [...inputs.values()].filter(
      (input) => input.issuedQuantity > 0,
    );
    const origins = new Map<string, any>();
    for (const move of consumedInputs) {
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
      inputs: consumedInputs.map((input) => {
        const actual =
          batch.status === 'COMPLETED' &&
          Array.isArray(batch.details.actualLots)
            ? batch.details.actualLots.find(
                (row: any) => row.lotId === input.lotId,
              )
            : null;
        return {
          ...input,
          consumedQuantity: Number(
            (input.issuedQuantity - input.returnedQuantity).toFixed(4),
          ),
          usedQuantity: actual ? Number(actual.used) : null,
          wasteQuantity: actual ? Number(actual.waste) : null,
          origin: origins.get(input.lotId),
        };
      }),
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
