import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import {
  Branch,
  Category,
  Product,
  Stock,
  StockItem,
  StockLot,
  StockMovement,
  KitchenMealPlan,
  KitchenProductionBatch,
  KitchenOperation,
  MeasurementUnit,
  StockTake,
  StockTakeItem,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  StockFundReceiptReason,
  MoneyVoucher,
  FundReceiptPaid,
  FundReceiptReceived,
} from '../src/entities';
import { StockTakeService } from '../src/modules/stock-take/stock-take.service';
import { StockVoucherService } from '../src/modules/stock-voucher/stock-voucher.service';
import { StockLotController } from '../src/modules/stock/stock-lot.controller';
import { StockService } from '../src/modules/stock/stock.service';
import {
  StockMovementService,
  localDate,
} from '../src/modules/stock/stock-movement.service';
import { KitchenOperationsService } from '../src/modules/kitchen/kitchen-operations.service';
import { KitchenPortalAndStockLots1764000000000 } from '../src/migrations/1764000000000-KitchenPortalAndStockLots';

// Use the application's connection settings, but never its schema or startup flags.
dotenv.config({ path: join(__dirname, '../.env'), quiet: true });
const connection = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'pos_system',
  installExtensions: false,
  connectTimeoutMS: 5000,
};
describe('Kitchen and lot ledger PostgreSQL integration', () => {
  const schema = 'kitchen_test_' + randomUUID().replaceAll('-', '');
  const movements = new StockMovementService();
  let schemaCreated = false;
  let control: DataSource,
    db: DataSource,
    branch: Branch,
    product: Product,
    stock: Stock;
  beforeAll(async () => {
    control = new DataSource({
      ...connection,
    });
    await control.initialize();
    await control.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    db = new DataSource({
      ...connection,
      schema,
      extra: { options: `-c search_path=${schema}` },
      entities: [join(__dirname, '../src/entities/*.entity.ts')],
      synchronize: true,
      migrationsRun: false,
      installExtensions: false,
      uuidExtension: 'pgcrypto',
    });
    await db.initialize();
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await new KitchenPortalAndStockLots1764000000000().up(runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    branch = await db
      .getRepository(Branch)
      .save({ name: 'Isolated kitchen test' });
    const category = await db
      .getRepository(Category)
      .save({ branchId: branch.id, name: 'Test' });
    product = await db.getRepository(Product).save({
      branchId: branch.id,
      categoryId: category.id,
      name: 'Ingredient',
      productType: 'INGREDIENT',
      lotTrackingEnabled: true,
      isCanteenItem: false,
    });
    stock = await db
      .getRepository(Stock)
      .save({ branchId: branch.id, name: 'Test stock' });
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (control?.isInitialized) {
      if (schemaCreated && /^kitchen_test_[a-f0-9]{32}$/.test(schema))
        await control.query(`DROP SCHEMA "${schema}" CASCADE`);
      await control.destroy();
    }
  });
  it('rolls back the lot, total stock and movement together on an injected failure', async () => {
    await expect(
      db.transaction(async (m) => {
        await movements.change(m, stock.id, product.id, 10, randomUUID(), {
          lotCode: 'rollback',
          expiresAt: '2099-12-31',
        });
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');
    expect(
      await db.getRepository(StockLot).countBy({ productId: product.id }),
    ).toBe(0);
    expect(
      await db.getRepository(StockItem).countBy({ productId: product.id }),
    ).toBe(0);
    expect(
      await db.getRepository(StockMovement).countBy({ productId: product.id }),
    ).toBe(0);
  });
  it('serializes concurrent exports and preserves total = sum of lots', async () => {
    await db.transaction((m) =>
      movements.change(m, stock.id, product.id, 10, randomUUID(), {
        lotCode: 'concurrent',
        expiresAt: '2099-12-31',
      }),
    );
    const lot = await db
      .getRepository(StockLot)
      .findOneByOrFail({ productId: product.id });
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        db.transaction((m) =>
          movements.change(m, stock.id, product.id, -7, randomUUID(), {
            allocations: [{ lotId: lot.id, quantity: 7 }],
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const total = await db
      .getRepository(StockItem)
      .findOneByOrFail({ stockId: stock.id, productId: product.id });
    const fresh = await db
      .getRepository(StockLot)
      .findOneByOrFail({ id: lot.id });
    expect(Number(total.quantity)).toBe(3);
    expect(Number(fresh.quantity)).toBe(3);
  });
  it('reconciles counted lots and transfers them once without changing expiry or global stock', async () => {
    const stockService = new StockService(db.getRepository(Stock));
    const counts = new StockTakeService(
      db.getRepository(StockTake),
      db.getRepository(StockTakeItem),
      db.getRepository(Product),
      db.getRepository(Stock),
      db.getRepository(StockItem),
      db,
      stockService,
      movements,
    );
    const lot = await db
      .getRepository(StockLot)
      .findOneByOrFail({ stockId: stock.id, productId: product.id });
    const draft = await counts.createDraft({
      branchId: branch.id,
      items: [
        {
          productId: product.id,
          actualQuantity: 2,
          lotCounts: [{ lotId: lot.id, actualQuantity: 2 }],
        },
      ],
    });
    await counts.complete(draft.id);
    const destination = await db
      .getRepository(Branch)
      .save({ name: 'Transfer destination' });
    const socket: any = {
      emitDashboardUpdated: jest.fn(),
      emitKitchenConsumptionUpdated: jest.fn(),
    };
    const vouchers = new StockVoucherService(
      db.getRepository(StockReceiptDetail),
      db.getRepository(StockReceiptImport),
      db.getRepository(StockReceiptExport),
      db.getRepository(StockReceiptTransfer),
      db.getRepository(StockFundReceiptReason),
      db.getRepository(StockItem),
      db.getRepository(MoneyVoucher),
      db.getRepository(FundReceiptPaid),
      db.getRepository(FundReceiptReceived),
      {} as any,
      {} as any,
      stockService,
      socket,
      db,
      movements,
    );
    const dto: any = {
      type: 'TRANSFER',
      branchId: branch.id,
      fromBranchId: branch.id,
      toBranchId: destination.id,
      requestId: randomUUID(),
      items: [
        {
          productId: product.id,
          quantity: 1,
          allocations: [{ lotId: lot.id, quantity: 1 }],
        },
      ],
    };
    await vouchers.createVoucher(dto);
    await vouchers.createVoucher(dto);
    const lots = await db
      .getRepository(StockLot)
      .findBy({ productId: product.id });
    const totals = await db
      .getRepository(StockItem)
      .findBy({ productId: product.id });
    expect(lots).toHaveLength(2);
    expect(
      lots.every(
        (l) => l.lotCode === lot.lotCode && l.expiresAt === lot.expiresAt,
      ),
    ).toBe(true);
    expect(lots.reduce((s, l) => s + Number(l.quantity), 0)).toBe(2);
    expect(totals.reduce((s, r) => s + Number(r.quantity), 0)).toBe(2);
    for (const row of totals)
      expect(Number(row.quantity)).toBe(
        lots
          .filter((l) => l.stockId === row.stockId)
          .reduce((s, l) => s + Number(l.quantity), 0),
      );
    expect(await db.getRepository(StockReceiptTransfer).count()).toBe(1);
  });
  it('preserves opening balances across warehouses and replays activation once', async () => {
    const unit = await db.getRepository(MeasurementUnit).save({
      code: 'opening-g',
      name: 'Test gram',
      dimension: 'MASS',
      factorToBase: 1,
    });
    const otherBranch = await db
      .getRepository(Branch)
      .save({ name: 'Other test branch' });
    const otherStock = await db
      .getRepository(Stock)
      .save({ branchId: otherBranch.id, name: 'Other test stock' });
    const fuel = await db.getRepository(Product).save({
      branchId: branch.id,
      categoryId: product.categoryId,
      name: 'Opening fuel',
      productType: 'FUEL',
      baseUnitId: unit.id,
      lotTrackingEnabled: false,
    });
    await db.getRepository(StockItem).save([
      { stockId: stock.id, productId: fuel.id, quantity: 3 },
      { stockId: otherStock.id, productId: fuel.id, quantity: 7 },
    ]);
    const controller = new StockLotController(
      db,
      movements,
      new StockService(db.getRepository(Stock)),
    );
    const actor = {
      userId: randomUUID(),
      userType: 'ADMIN',
      branchId: branch.id,
    };
    await expect(
      controller.opening(
        { user: actor },
        {
          productId: fuel.id,
          branchId: branch.id,
          lots: [{ lotCode: 'source', quantity: 3 }],
        },
      ),
    ).rejects.toThrow('OTHER_WAREHOUSE_OPENING_REQUIRED');
    expect(
      (await db.getRepository(Product).findOneByOrFail({ id: fuel.id }))
        .lotTrackingEnabled,
    ).toBe(false);
    const request = {
      productId: fuel.id,
      branchId: branch.id,
      requestId: randomUUID(),
      stockAllocations: [
        { stockId: stock.id, lots: [{ lotCode: 'source', quantity: 3 }] },
        {
          stockId: otherStock.id,
          lots: [{ lotCode: 'destination', quantity: 7 }],
        },
      ],
    };
    await expect(
      controller.opening({ user: { ...actor, userType: 'MANAGER' } }, request),
    ).rejects.toThrow('CROSS_BRANCH_FORBIDDEN');
    const result = await controller.opening({ user: actor }, request);
    expect((await controller.opening({ user: actor }, request)).productId).toBe(
      result.productId,
    );
    expect(
      await db.getRepository(StockLot).countBy({ productId: fuel.id }),
    ).toBe(2);
    const lots = await db
      .getRepository(StockLot)
      .findBy({ productId: fuel.id });
    const totals = await db
      .getRepository(StockItem)
      .findBy({ productId: fuel.id });
    expect(lots.map((l) => Number(l.quantity)).sort()).toEqual([3, 7]);
    expect(totals.map((l) => Number(l.quantity)).sort()).toEqual([3, 7]);
  });
  it('replays an import once, quarantines returns and enforces the source shift lock', async () => {
    const actor = {
      userId: randomUUID(),
      userType: 'MANAGER',
      branchId: branch.id,
    };
    const service = new KitchenOperationsService(
      db,
      { get: () => 'true' } as any,
      {
        emitKitchenConsumptionUpdated: jest.fn(),
        emitKitchenBatchUpdated: jest.fn(),
      } as any,
    );
    const dish = await db.getRepository(Product).save({
      branchId: branch.id,
      categoryId: product.categoryId,
      name: 'Dish',
      productType: 'FINISHED_GOOD',
      recommendedUseMinutes: 120,
    });
    const plan = await db.getRepository(KitchenMealPlan).save({
      branchId: branch.id,
      planDate: localDate(),
      mealPeriod: 'LUNCH',
    });
    const batch = await db.getRepository(KitchenProductionBatch).save({
      mealPlanId: plan.id,
      mealItemId: null,
      productId: dish.id,
      plannedQuantity: 10,
      actualQuantity: 10,
      status: 'COMPLETED',
      readyAt: new Date(),
      source: 'MANUAL',
      shift: 'Ca trưa',
    });
    const input = {
      branchId: branch.id,
      batchId: batch.id,
      quantity: 10,
      receiverArea: 'Dining hall',
      requestId: randomUUID(),
    };
    const doc = await service.write(actor, 'finished-imports', input);
    expect(
      (
        await service.write(
          actor,
          'finished-imports',
          JSON.parse(JSON.stringify(input)),
        )
      ).id,
    ).toBe(doc.id);
    const imported = await service.action(
      actor,
      'finished-imports',
      doc.id,
      'confirm',
    );
    await service.action(actor, 'finished-imports', doc.id, 'confirm');
    expect(
      await db
        .getRepository(KitchenOperation)
        .countBy({ kind: 'finished-inventory', parentId: doc.id }),
    ).toBe(1);
    const exported = await service.write(actor, 'finished-exports', {
      lotId: imported.payload.lotId,
      quantity: 6,
      receiverPlace: 'Room 1',
      receivedBy: 'Teacher',
      requestId: randomUUID(),
    });
    const returned = {
      quantity: 2,
      reason: 'Unused portions',
      requestId: randomUUID(),
    };
    await service.action(
      actor,
      'finished-exports',
      exported.id,
      'returns',
      returned,
    );
    await service.action(
      actor,
      'finished-exports',
      exported.id,
      'returns',
      returned,
    );
    await expect(
      service.action(actor, 'finished-exports', exported.id, 'returns', {
        ...returned,
        quantity: 5,
        requestId: randomUUID(),
      }),
    ).rejects.toThrow('RETURN_EXCEEDS_EXPORT');
    const lot = await db
      .getRepository(KitchenOperation)
      .findOneByOrFail({ id: imported.payload.lotId });
    expect(lot.payload.availableQuantity).toBe(4);
    expect(lot.payload.quarantinedQuantity).toBe(2);
    const closing = await service.write(actor, 'shift-closings', {
      date: plan.planDate,
      shift: 'Ca trưa',
    });
    await service.action(actor, 'shift-closings', closing.id, 'confirm');
    await expect(
      service.write(actor, 'finished-exports', {
        lotId: lot.id,
        quantity: 1,
        receiverPlace: 'Room 2',
        receivedBy: 'Teacher',
        date: '2099-01-01',
      }),
    ).rejects.toThrow('KITCHEN_SHIFT_LOCKED');
    expect(
      (await db.getRepository(KitchenOperation).findOneByOrFail({ id: lot.id }))
        .payload.availableQuantity,
    ).toBe(4);
    const approved = await service.action(
      actor,
      'shift-closings',
      closing.id,
      'approve',
    );
    const snapshot = JSON.stringify(approved.payload.snapshot);
    const reopened = await service.action(
      actor,
      'shift-closings',
      closing.id,
      'reopen',
      { reason: 'Reviewed correction' },
    );
    expect(JSON.stringify(reopened.payload.revisions[0].snapshot)).toBe(
      snapshot,
    );
  });
});
