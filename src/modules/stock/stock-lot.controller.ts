import {
  BadRequestException,
  ConflictException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataSource, In } from 'typeorm';
import {
  Product,
  Stock,
  StockItem,
  StockLot,
  MeasurementUnit,
  StockRequest,
} from '../../entities';
import { isUUID } from 'class-validator';
import { requestFingerprint } from '../../common/utils/request-fingerprint';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import {
  StockMovementService,
  localDate,
  positive,
} from './stock-movement.service';
import { resolveStockBranch } from './stock-scope';
import { StockService } from './stock.service';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

@ApiTags('Stock lots')
@ApiBearerAuth()
@Controller('stock-lots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockLotController {
  constructor(
    private db: DataSource,
    private movements: StockMovementService,
    private stocks: StockService,
  ) {}
  @Get()
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
  async list(@Req() req: any, @Query() q: any) {
    const branchId = resolveStockBranch(req.user, q.branchId);
    const p = normalizePagination(q.page, q.size);
    const qb = this.db
      .getRepository(StockLot)
      .createQueryBuilder('l')
      .innerJoin(Stock, 's', 's.id=l.stock_id')
      .innerJoin(Product, 'p', 'p.id=l.product_id')
      .where('s.branch_id=:branchId', { branchId });
    if (q.productId)
      qb.andWhere('l.product_id=:productId', { productId: q.productId });
    if (q.productType)
      qb.andWhere('p.product_type=:type', { type: q.productType });
    if (q.status === 'AVAILABLE')
      qb.andWhere(
        '(l.expires_at IS NULL OR l.expires_at>=:today) AND l.quantity>0',
        { today: localDate() },
      );
    if (q.status === 'EXPIRED')
      qb.andWhere('l.expires_at<:today AND l.quantity>0', {
        today: localDate(),
      });
    const [rows, total] = await qb
      .orderBy('l.expires_at', 'ASC', 'NULLS LAST')
      .skip(p.skip)
      .take(p.size)
      .getManyAndCount();
    return toPaginationResponse(rows, total, p.page, p.size);
  }
  @Get('opening-preview')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  async preview(@Req() req: any, @Query() q: any) {
    const branchId = resolveStockBranch(req.user, q.branchId);
    if (q.productId) {
      if (!isUUID(q.productId))
        throw new BadRequestException('INVALID_LOT_PRODUCT');
      const product = await this.db
        .getRepository(Product)
        .findOneBy({ id: q.productId, branchId });
      if (
        !product ||
        product.lotTrackingEnabled ||
        !['INGREDIENT', 'FUEL'].includes(product.productType || '')
      )
        throw new BadRequestException('INVALID_LOT_PRODUCT');
      const stockAllocations = await this.db.query(
        `SELECT si.stock_id AS "stockId",s.branch_id AS "branchId",b.name AS "branchName",s.name AS "stockName",si.quantity FROM stock_items si JOIN stocks s ON s.id=si.stock_id JOIN branches b ON b.id=s.branch_id WHERE si.product_id=$1 AND ($2::boolean OR s.branch_id=$3) ORDER BY si.stock_id`,
        [product.id, req.user.userType === 'ADMIN', branchId],
      );
      const [outside] = await this.db.query(
        'SELECT EXISTS(SELECT 1 FROM stock_items si JOIN stocks s ON s.id=si.stock_id WHERE si.product_id=$1 AND s.branch_id<>$2 AND si.quantity<>0) AS required',
        [product.id, branchId],
      );
      return {
        productId: product.id,
        stockAllocations,
        requiresAdmin: req.user.userType !== 'ADMIN' && outside.required,
      };
    }
    return this.db.query(
      `SELECT si.product_id AS "productId", si.quantity, p.name,p.product_type AS "productType" FROM stock_items si JOIN stocks s ON s.id=si.stock_id JOIN products p ON p.id=si.product_id WHERE s.branch_id=$1 AND p.lot_tracking_enabled=false AND p.product_type IN ('INGREDIENT','FUEL')`,
      [branchId],
    );
  }
  @Post('opening')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  async opening(@Req() req: any, @Body() dto: any) {
    const branchId = resolveStockBranch(req.user, dto.branchId);
    if (!isUUID(dto.productId) || (dto.requestId && !isUUID(dto.requestId)))
      throw new BadRequestException('INVALID_OPENING_REQUEST');
    return this.db.transaction(async (m) => {
      if (dto.requestId)
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          dto.requestId,
        ]);
      await this.movements.lockProducts(m, [dto.productId]);
      if (dto.requestId) {
        const previous = await m
          .getRepository(StockRequest)
          .findOneBy({ branchId, requestId: dto.requestId });
        if (previous) {
          if (previous.payloadHash !== requestFingerprint(dto))
            throw new ConflictException('IDEMPOTENCY_PAYLOAD_CONFLICT');
          return previous.result;
        }
      }
      const product = await m.getRepository(Product).findOne({
        where: { id: dto.productId, branchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !product ||
        !['INGREDIENT', 'FUEL'].includes(product.productType || '')
      )
        throw new BadRequestException('INVALID_LOT_PRODUCT');
      if (!product.baseUnitId)
        throw new BadRequestException('BASE_UNIT_REQUIRED');
      if (
        !(await m
          .getRepository(MeasurementUnit)
          .findOneBy({ id: product.baseUnitId, isActive: true }))
      )
        throw new BadRequestException('BASE_UNIT_REQUIRED');
      // Tracking is product-wide. Never enable it while another warehouse has an
      // unallocated opening balance: doing so would orphan that physical stock.
      const balances = await m.getRepository(StockItem).find({
        where: { productId: product.id },
        order: { stockId: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (product.lotTrackingEnabled)
        throw new BadRequestException('LOT_TRACKING_ALREADY_ENABLED');
      let allocations = dto.stockAllocations;
      if (allocations === undefined) {
        const stock = await this.stocks.getOrCreateBranchStock(branchId, m);
        allocations = [{ stockId: stock.id, lots: dto.lots }];
      }
      if (
        !Array.isArray(allocations) ||
        !allocations.length ||
        new Set(allocations.map((a) => a.stockId)).size !== allocations.length
      )
        throw new BadRequestException('INVALID_OPENING_STOCKS');
      if (
        balances.some(
          (balance) =>
            Number(balance.quantity) !== 0 &&
            !allocations.some((a) => a.stockId === balance.stockId),
        )
      )
        throw new BadRequestException('OTHER_WAREHOUSE_OPENING_REQUIRED');
      const totals: StockItem[] = [];
      for (const allocation of [...allocations].sort((a, b) =>
        String(a.stockId).localeCompare(String(b.stockId)),
      )) {
        if (!isUUID(allocation.stockId))
          throw new BadRequestException('INVALID_OPENING_STOCK');
        const stock = await m
          .getRepository(Stock)
          .findOneBy({ id: allocation.stockId });
        if (!stock) throw new BadRequestException('INVALID_OPENING_STOCK');
        resolveStockBranch(req.user, stock.branchId);
        const total = await this.movements.lock(m, stock.id, product.id);
        if (
          !Array.isArray(allocation.lots) ||
          !allocation.lots.length ||
          Math.abs(
            allocation.lots.reduce(
              (sum, lot) => sum + positive(lot.quantity, true),
              0,
            ) - Number(total.quantity),
          ) > 0.00005
        )
          throw new BadRequestException('OPENING_BALANCE_MISMATCH');
        totals.push(total);
      }
      product.lotTrackingEnabled = true;
      await m.save(product);
      for (const total of totals) {
        total.quantity = 0;
        await m.save(total);
        for (const lot of allocations.find((a) => a.stockId === total.stockId)
          .lots)
          if (Number(lot.quantity) > 0)
            await this.movements.change(
              m,
              total.stockId,
              product.id,
              Number(lot.quantity),
              product.id,
              { ...lot, actorId: req.user.userId },
            );
      }
      const result = {
        productId: product.id,
        lotTrackingEnabled: true,
        note: dto.note || null,
        balances: await m.getRepository(StockItem).findBy({
          productId: product.id,
          stockId: In(allocations.map((a) => a.stockId)),
        }),
      };
      if (dto.requestId)
        await m.getRepository(StockRequest).save({
          branchId,
          requestId: dto.requestId,
          payloadHash: requestFingerprint(dto),
          result,
          createdBy: req.user.userId,
        });
      return result;
    });
  }
}
