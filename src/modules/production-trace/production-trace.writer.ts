import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  Stock,
  StockLot,
  Product,
  KitchenProductionBatch,
} from '../../entities';
import { FinishedUnit } from '../../entities/finished-unit.entity';
import {
  StockMovementService,
  positive,
} from '../stock/stock-movement.service';
import { portionCount } from './production-trace.rules';

export async function consumeBatchLots(
  m: EntityManager,
  movements: StockMovementService,
  batch: KitchenProductionBatch,
  branchId: string,
  inputs: Array<{ lotId: string; quantity: number }>,
  actorId: string,
) {
  if (!Array.isArray(inputs) || !inputs.length)
    throw new BadRequestException('BATCH_INPUT_LOTS_REQUIRED');
  if (new Set(inputs.map((i) => i.lotId)).size !== inputs.length)
    throw new BadRequestException('DUPLICATE_LOT');
  const groups = new Map<
    string,
    { stockId: string; productId: string; allocations: typeof inputs }
  >();
  for (const input of inputs) {
    positive(input.quantity);
    const lot = await m.getRepository(StockLot).findOneBy({ id: input.lotId });
    if (!lot) throw new BadRequestException('LOT_NOT_FOUND');
    const stock = await m
      .getRepository(Stock)
      .findOneBy({ id: lot.stockId, branchId });
    const product = await m
      .getRepository(Product)
      .findOneBy({ id: lot.productId });
    if (
      !stock ||
      !product?.lotTrackingEnabled ||
      !['INGREDIENT', 'FUEL'].includes(product.productType || '')
    )
      throw new BadRequestException('INVALID_BATCH_INPUT_LOT');
    const key = `${lot.stockId}:${lot.productId}`;
    const group = groups.get(key) || {
      stockId: lot.stockId,
      productId: lot.productId,
      allocations: [],
    };
    group.allocations.push(input);
    groups.set(key, group);
  }
  await movements.lockProducts(
    m,
    [...groups.values()].map((g) => g.productId),
  );
  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    await movements.change(
      m,
      group.stockId,
      group.productId,
      -group.allocations.reduce((s, a) => s + Number(a.quantity), 0),
      batch.id,
      { allocations: group.allocations, actorId },
    );
  }
  batch.details.inputLots = inputs.map((i) => ({
    lotId: i.lotId,
    quantity: Number(i.quantity),
  }));
  batch.details.traceabilityVersion = 1;
}

export async function createFinishedUnits(
  m: EntityManager,
  batch: KitchenProductionBatch,
  branchId: string,
  actorId: string,
) {
  const count = portionCount(batch.actualQuantity);
  const expiry = new Date(batch.details.servingExpiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry <= new Date())
    throw new ConflictException('FINISHED_BATCH_EXPIRED_OR_EXPIRY_MISSING');
  const repo = m.getRepository(FinishedUnit);
  if (await repo.countBy({ batchId: batch.id }))
    throw new ConflictException('FINISHED_UNITS_ALREADY_CREATED');
  for (let offset = 0; offset < count; offset += 500) {
    await repo.insert(
      Array.from({ length: Math.min(500, count - offset) }, (_, i) => ({
        id: randomUUID(),
        batchId: batch.id,
        branchId,
        productId: batch.productId,
        serial: offset + i + 1,
        expiresAt: expiry,
        createdBy: actorId,
      })),
    );
  }
  batch.details.finishedUnitCount = count;
}
