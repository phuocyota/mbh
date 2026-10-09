import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Product,
  MeasurementUnit,
  StockItem,
  StockLot,
  StockMovement,
} from '../../entities';

export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function positive(value: unknown, allowZero = false) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    throw new BadRequestException('INVALID_QUANTITY');
  const n = Number(value);
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0))
    throw new BadRequestException('INVALID_QUANTITY');
  return n;
}
export function convertQuantity(
  quantity: number,
  from: { dimension: string; factorToBase: number },
  to: { dimension: string; factorToBase: number },
) {
  if (from.dimension !== to.dimension)
    throw new BadRequestException('INCOMPATIBLE_INGREDIENT_UNIT');
  return Number(
    ((quantity * Number(from.factorToBase)) / Number(to.factorToBase)).toFixed(
      4,
    ),
  );
}
export function validateAllocations(
  quantity: number,
  allocations: any[],
  today: string,
  lots: StockLot[],
  allowExpired = false,
) {
  if (!Array.isArray(allocations) || !allocations.length)
    throw new BadRequestException('LOT_ALLOCATION_REQUIRED');
  if (new Set(allocations.map((a) => a.lotId)).size !== allocations.length)
    throw new BadRequestException('DUPLICATE_LOT');
  if (
    Math.abs(
      allocations.reduce((s, a) => s + positive(a.quantity), 0) - quantity,
    ) > 0.00005
  )
    throw new BadRequestException('LOT_ALLOCATION_MISMATCH');
  for (const a of allocations) {
    const lot = lots.find((l) => l.id === a.lotId);
    if (!lot) throw new BadRequestException('LOT_NOT_IN_STOCK');
    if (!allowExpired && lot.expiresAt && lot.expiresAt < today)
      throw new ConflictException('LOT_EXPIRED');
    if (Number(lot.quantity) < Number(a.quantity))
      throw new ConflictException('LOT_STOCK_SHORTAGE');
  }
}

@Injectable()
export class StockMovementService {
  async lockProducts(manager: EntityManager, productIds: string[]) {
    for (const id of [...new Set(productIds)].sort())
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        ['stock-product:' + id],
      );
  }
  async lock(manager: EntityManager, stockId: string, productId: string) {
    await this.lockProducts(manager, [productId]);
    // Serializes creation as well as updates, including the initially absent stock row.
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [`${stockId}:${productId}`],
    );
    const repo = manager.getRepository(StockItem);
    let row = await repo.findOne({
      where: { stockId, productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row)
      row = await repo.save(repo.create({ stockId, productId, quantity: 0 }));
    return row;
  }
  async normalize(manager: EntityManager, product: Product, item: any) {
    const quantity = positive(item.quantity);
    if (!item.unitId) return quantity;
    const units = manager.getRepository(MeasurementUnit);
    const from = await units.findOneBy({ id: item.unitId, isActive: true });
    const to =
      product.baseUnitId &&
      (await units.findOneBy({ id: product.baseUnitId, isActive: true }));
    if (!from || !to)
      throw new BadRequestException('PRODUCT_BASE_UNIT_REQUIRED');
    return positive(convertQuantity(quantity, from, to));
  }
  async recount(
    manager: EntityManager,
    stockId: string,
    productId: string,
    expectedQuantity: number,
    actualQuantity: number,
    lotCounts: Array<{ lotId: string; actualQuantity: number }> | null,
    referenceId: string,
    actorId?: string,
  ) {
    const actual = positive(actualQuantity, true);
    const row = await this.lock(manager, stockId, productId);
    if (Number(row.quantity) !== Number(expectedQuantity))
      throw new ConflictException('STOCK_CHANGED_SINCE_COUNT');
    const product = await manager
      .getRepository(Product)
      .findOneByOrFail({ id: productId });
    if (!product.lotTrackingEnabled)
      return this.change(
        manager,
        stockId,
        productId,
        actual - Number(row.quantity),
        referenceId,
        { actorId },
      );
    const lots = await manager.getRepository(StockLot).find({
      where: { stockId, productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !lotCounts ||
      lotCounts.length !== lots.length ||
      new Set(lotCounts.map((l) => l.lotId)).size !== lots.length
    )
      throw new BadRequestException('ALL_LOT_COUNTS_REQUIRED');
    if (
      Math.abs(
        lotCounts.reduce(
          (sum, l) => sum + positive(l.actualQuantity, true),
          0,
        ) - actual,
      ) > 0.00005
    )
      throw new BadRequestException('LOT_COUNT_MISMATCH');
    for (const count of lotCounts) {
      const lot = lots.find((l) => l.id === count.lotId);
      if (!lot) throw new BadRequestException('INVALID_LOT');
      const quantity = positive(count.actualQuantity, true);
      const delta = quantity - Number(lot.quantity);
      lot.quantity = quantity;
      lot.updatedBy = actorId;
      await manager.save(lot);
      await manager.getRepository(StockMovement).save({
        stockId,
        productId,
        lotId: lot.id,
        referenceId,
        quantity: delta,
        createdBy: actorId,
      });
    }
    row.quantity = actual;
    row.updatedBy = actorId;
    return manager.save(row);
  }
  async change(
    manager: EntityManager,
    stockId: string,
    productId: string,
    delta: number,
    referenceId: string,
    options: any = {},
  ) {
    if (!Number.isFinite(delta))
      throw new BadRequestException('INVALID_QUANTITY');
    const row = await this.lock(manager, stockId, productId);
    const product = await manager
      .getRepository(Product)
      .findOneBy({ id: productId });
    if (!product) throw new NotFoundException('PRODUCT_NOT_FOUND');
    if (Number(row.quantity) + delta < -0.00005)
      throw new ConflictException('STOCK_SHORTAGE');
    const lotRepo = manager.getRepository(StockLot);
    const portions: Array<{ lotId: string | null; quantity: number }> = [];
    if (product.lotTrackingEnabled) {
      if (delta > 0) {
        if (!String(options.lotCode || '').trim())
          throw new BadRequestException('LOT_CODE_REQUIRED');
        if (product.productType === 'INGREDIENT' && !options.expiresAt)
          throw new BadRequestException('LOT_EXPIRY_REQUIRED');
        for (const key of ['manufacturedAt', 'expiresAt'])
          if (
            options[key] &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(options[key]) ||
              !Number.isFinite(Date.parse(options[key])) ||
              new Date(options[key]).toISOString().slice(0, 10) !==
                options[key])
          )
            throw new BadRequestException('INVALID_LOT_DATE');
        if (
          options.manufacturedAt &&
          options.expiresAt &&
          options.manufacturedAt > options.expiresAt
        )
          throw new BadRequestException('INVALID_LOT_DATE');
        let lot = await lotRepo.findOne({
          where: { stockId, productId, lotCode: options.lotCode },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          lot &&
          (lot.expiresAt !== (options.expiresAt || null) ||
            lot.manufacturedAt !== (options.manufacturedAt || null))
        )
          throw new ConflictException('LOT_METADATA_CONFLICT');
        if (!lot)
          lot = lotRepo.create({
            stockId,
            productId,
            lotCode: options.lotCode,
            expiresAt: options.expiresAt || null,
            manufacturedAt: options.manufacturedAt || null,
            quantity: 0,
            createdBy: options.actorId,
          });
        lot.quantity = Number(lot.quantity) + delta;
        lot.updatedBy = options.actorId;
        lot = await lotRepo.save(lot);
        portions.push({ lotId: lot.id, quantity: delta });
      } else if (delta < 0) {
        const lots = await lotRepo.find({
          where: { stockId, productId },
          lock: { mode: 'pessimistic_write' },
        });
        validateAllocations(
          -delta,
          options.allocations,
          localDate(),
          lots,
          options.allowExpired === true,
        );
        for (const a of options.allocations) {
          const lot = lots.find((l) => l.id === a.lotId)!;
          lot.quantity = Number(lot.quantity) - Number(a.quantity);
          lot.updatedBy = options.actorId;
          await lotRepo.save(lot);
          portions.push({ lotId: lot.id, quantity: -Number(a.quantity) });
        }
      }
    } else portions.push({ lotId: null, quantity: delta });
    row.quantity = Number((Number(row.quantity) + delta).toFixed(4));
    row.updatedBy = options.actorId;
    await manager.save(row);
    for (const part of portions)
      await manager.getRepository(StockMovement).save({
        stockId,
        productId,
        referenceId,
        createdBy: options.actorId,
        ...part,
      });
    return row;
  }
}
