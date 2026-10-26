// User-requested one-time stock correction. Preview rolls back; --commit persists.
// Reuses the stock-take domain; never deletes products, receipts or movements.
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { DataSource } = require('typeorm');
const E = require('../dist/src/entities');
const { StockTakeService } = require('../dist/src/modules/stock-take/stock-take.service');
const { StockService } = require('../dist/src/modules/stock/stock.service');
const { StockMovementService } = require('../dist/src/modules/stock/stock-movement.service');
const branchId = '4a3ce246-0adb-4b06-8065-71714eeab9c7';
const stockId = '36a403ef-ec94-429a-9ead-2b71f3dcad03';
const marker = 'repair:boarding-stock:20261026';
const note = `${marker} - Theo yêu cầu chủ hệ thống: đưa tồn cũ của món bán trú chế biến về 0; giữ nguyên tồn nguyên liệu, lịch sử và công thức.`;
const expected = [
  { id: '51c9d334-a546-419b-bc58-8afdcfa50a9d', code: 'SP000017', quantity: 3 },
  { id: '4bfadab1-3a15-4f87-b178-d9d13f71ef70', code: 'SP000020', quantity: 5 },
  { id: '6737b77c-d5a2-4101-805c-55b6c63bf5bf', code: 'SP000021', quantity: 8 },
];
const db = new DataSource({
  type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  entities: [path.resolve(__dirname, '../dist/src/entities/*.entity.js')],
  synchronize: false, migrationsRun: false, installExtensions: false, logging: false,
  extra: { connectionTimeoutMillis: 7000 },
});
(async () => {
  await db.initialize();
  const runner = db.createQueryRunner();
  try {
    await runner.connect(); await runner.startTransaction();
    const m = runner.manager;
    await m.query("SET LOCAL lock_timeout='5s'");
    await m.query("SET LOCAL statement_timeout='20s'");
    const movements = new StockMovementService();
    await movements.lockProducts(m, expected.map((p) => p.id));
    const stocks = await m.query('SELECT id FROM stocks WHERE branch_id=$1 ORDER BY id', [branchId]);
    assert.deepEqual(stocks, [{ id: stockId }], 'Stop: stock topology changed');
    const prior = await m.query('SELECT id,status,code FROM stock_takes WHERE branch_id=$1 AND note=$2', [branchId, note]);
    if (prior.length) {
      assert.equal(prior.length, 1); assert.equal(prior[0].status, 'COMPLETED');
      await runner.rollbackTransaction();
      console.log(JSON.stringify({ alreadyApplied: true, stockTake: prior[0] }));
      return;
    }
    const rows = await m.query(`SELECT si.*,p.code,p.name,p.is_boarding,p.requires_cooking,p.product_type,p.lot_tracking_enabled
      FROM stock_items si JOIN stocks s ON s.id=si.stock_id JOIN products p ON p.id=si.product_id
      WHERE s.branch_id=$1 AND p.is_boarding=true AND si.quantity<>0 ORDER BY p.code FOR UPDATE OF si,p`, [branchId]);
    assert.equal(rows.length, expected.length, 'Stop: nonzero boarding balances changed');
    for (const p of expected) {
      const row = rows.find((r) => r.product_id === p.id);
      assert.ok(row); assert.equal(row.code, p.code); assert.equal(row.stock_id, stockId);
      assert.equal(Number(row.quantity), p.quantity, 'Stop: quantity changed since preview');
      assert.equal(row.is_boarding, true); assert.equal(row.requires_cooking, true);
      assert.equal(row.product_type, 'FINISHED_GOOD'); assert.equal(row.lot_tracking_enabled, false);
    }
    const ids = expected.map((p) => p.id);
    const lots = await m.query('SELECT * FROM stock_lots WHERE stock_id=$1 AND product_id=ANY($2::uuid[])', [stockId, ids]);
    assert.equal(lots.length, 0, 'Stop: lot reconciliation required');
    const backupPath = '/private/tmp/mbh-boarding-stock-20261026-before.json';
    if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, JSON.stringify({ branchId, stockId, rows }, null, 2), { mode: 0o600, flag: 'wx' });
    // Both existing service transactions participate in this single outer transaction.
    const service = new StockTakeService(
      m.getRepository(E.StockTake), m.getRepository(E.StockTakeItem),
      m.getRepository(E.Product), m.getRepository(E.Stock), m.getRepository(E.StockItem),
      { transaction: (fn) => fn(m) }, new StockService(m.getRepository(E.Stock)), movements,
    );
    const draft = await service.createDraft({ branchId, note, actorId: marker,
      items: expected.map((p) => ({ productId: p.id, actualQuantity: 0 })),
    });
    const take = await service.complete(draft.id, marker);
    assert.equal(take.status, 'COMPLETED'); assert.equal(Number(take.decreaseQuantity), 16);
    const balances = await m.query('SELECT product_id,quantity FROM stock_items WHERE stock_id=$1 AND product_id=ANY($2::uuid[]) ORDER BY product_id', [stockId, ids]);
    assert.equal(balances.length, 3); assert.ok(balances.every((r) => Number(r.quantity) === 0));
    const changes = await m.query('SELECT product_id,quantity FROM stock_movements WHERE reference_id=$1 ORDER BY product_id', [take.id]);
    assert.equal(changes.length, 3);
    for (const p of expected) assert.equal(Number(changes.find((r) => r.product_id === p.id)?.quantity), -p.quantity);
    const commit = process.argv.includes('--commit');
    if (commit) await runner.commitTransaction(); else await runner.rollbackTransaction();
    console.log(JSON.stringify({ committed: commit, branchId, stockTakeId: take.id, stockTakeCode: take.code,
      corrected: expected.map((p) => ({ code: p.code, before: p.quantity, after: 0 })), backupPath }, null, 2));
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally { await runner.release(); await db.destroy(); }
})().catch((error) => { console.error(JSON.stringify({ error: error.message, code: error.code })); process.exitCode = 1; });
