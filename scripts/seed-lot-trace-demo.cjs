// Preview by default. Uses existing voucher/movement services inside one transaction.
// node scripts/seed-lot-trace-demo.cjs --branch=<uuid> [--serials] [--commit]
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { AppDataSource: db } = require('../dist/src/data-source');
const E = require('../dist/src/entities');
const { StockVoucherService } = require('../dist/src/modules/stock-voucher/stock-voucher.service');
const { StockService } = require('../dist/src/modules/stock/stock.service');
const { StockMovementService, localDate } = require('../dist/src/modules/stock/stock-movement.service');
const { StockTraceService } = require('../dist/src/modules/stock-trace/stock-trace.service');
const branchId = process.argv.find((arg) => arg.startsWith('--branch='))?.slice(9);
if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(branchId || '')) throw new Error('--branch=<uuid> is required');
const commit = process.argv.includes('--commit');
const marker = 'DEMO-TRACE-20261019';
const supplierCode = `${marker}-${branchId.slice(0, 8)}`;
const today = localDate();
function day(offset) { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
const plan = [
  { key: 'HEO-TUOI', product: 'HEO', quantity: 20, bought: 0, expiry: 7, consume: 4 },
  { key: 'HEO-SAP-HET-HAN', product: 'HEO', quantity: 10, bought: -5, expiry: 2 },
  { key: 'HEO-CON-HAN', product: 'HEO', quantity: 5, bought: 0, expiry: 14 },
  { key: 'GAO-CON-HAN', product: 'GAO', quantity: 50, bought: 0, expiry: 180 },
  { key: 'DAU-CON-HAN', product: 'DAU', quantity: 20, bought: 0, expiry: 90 },
  { key: 'GAO-DA-DUNG-HET', product: 'GAO', quantity: 10, bought: 0, expiry: 180, consume: 10 },
];
function requestId(step) {
  const b = crypto.createHash('sha256').update(`${branchId}:${marker}:${step}`).digest().subarray(0, 16);
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function voucherService(manager) {
  const repo = (name) => manager.getRepository(E[name]);
  const forbiddenFinancialAction = new Proxy({}, { get: () => () => { throw new Error('Demo must not create financial entries'); } });
  return new StockVoucherService(...['StockReceiptDetail','StockReceiptImport','StockReceiptExport','StockReceiptTransfer','StockFundReceiptReason','StockItem','MoneyVoucher','FundReceiptPaid','FundReceiptReceived'].map(repo),
    forbiddenFinancialAction, forbiddenFinancialAction, new StockService(repo('Stock')), {}, db, new StockMovementService());
}
function traceService(manager) {
  return new StockTraceService(db, ...['StockLot','StockMovement','StockReceiptDetail','StockReceiptImport','StockReceiptExport','Product','Supplier','Branch','Stock','ProductRecipe','ProductRecipeItem','KitchenProductionBatch','KitchenOperation'].map((name) => manager.getRepository(E[name])));
}
async function verify(manager) {
  const trace = traceService(manager);
  const lots = [];
  for (const item of plan) {
    const lot = await manager.getRepository(E.StockLot).findOneByOrFail({ lotCode: `${marker}-${item.key}` });
    const stock = await manager.getRepository(E.Stock).findOneByOrFail({ id: lot.stockId, branchId });
    assert.ok(stock);
    assert.equal(Number(lot.quantity), item.quantity - (item.consume || 0));
    const origin = await trace.getFullTrace({ lotId: lot.id });
    assert.equal(origin.origin.supplier.code, supplierCode);
    assert.ok(origin.movements.length >= (item.consume ? 2 : 1));
    lots.push({ lotCode: lot.lotCode, lotId: lot.id, quantity: Number(lot.quantity), expiresAt: lot.expiresAt, movements: origin.movements.length, supplier: origin.origin.supplier.name });
  }
  for (const key of ['HEO','GAO','DAU']) {
    const product = await manager.getRepository(E.Product).findOneByOrFail({ branchId, code: `DEMO-${key}` });
    const rows = await manager.query('SELECT COALESCE(SUM(quantity),0)::numeric AS quantity FROM stock_items WHERE product_id=$1', [product.id]);
    assert.equal(Number(rows[0].quantity), plan.filter((i) => i.product === key).reduce((n, i) => n + i.quantity - (i.consume || 0), 0));
  }
  return lots;
}
async function seedSerialDemo() {
  const { StockSerialService } = require('../dist/src/modules/stock/stock-serial.service');
  const serialMarker = 'DEMO-SERIAL-20261019';
  const productCode = 'DEMO-SERIAL-HOP';
  const branch = await db.getRepository(E.Branch).findOneByOrFail({ id: branchId });
  const supplier = await db.getRepository(E.Supplier).findOneByOrFail({ branchId, code: supplierCode });
  const category = await db.getRepository(E.Category).findOneByOrFail({ branchId, name: 'DEMO - Nguyên liệu truy xuất' });
  const reason = await db.getRepository(E.StockFundReceiptReason).findOneBy({ code: 'NHNCC', isDebt: true, status: 'active' });
  assert.ok(reason, 'NHNCC debt reason must already exist');
  const existing = await db.getRepository(E.Product).findOneBy({ branchId, code: productCode });
  const manual = Array.from({ length: 5 }, (_, index) => `${serialMarker}-${String(index + 1).padStart(3, '0')}`);
  const verifySerials = async (manager) => {
    const product = await manager.getRepository(E.Product).findOneByOrFail({ branchId, code: productCode });
    const service = new StockSerialService({ query: (sql, params) => manager.query(sql, params) });
    const result = await service.list(branchId, { productId: product.id, size: 100 });
    assert.equal(result.total, 8);
    assert.equal(result.data.filter((row) => row.serialMode === 'MANUAL').length, 5);
    assert.equal(result.data.filter((row) => row.serialMode === 'AUTO').length, 3);
    assert.equal(new Set(result.data.map((row) => row.serial)).size, 8);
    const lotIds = new Set();
    for (const row of result.data) {
      assert.equal(row.supplierId, supplier.id);
      assert.equal(row.receiptStatus, 'COMPLETED');
      assert.ok(row.lotId && row.stockId && row.receiptId);
      if (row.serialMode === 'MANUAL') assert.ok(manual.includes(row.serial));
      const detail = await service.detail(branchId, row.detailId, row.position);
      assert.equal(detail.serial, row.serial);
      lotIds.add(row.lotId);
    }
    assert.equal(lotIds.size, 2);
    for (const lotId of lotIds) {
      const trace = await traceService(manager).getFullTrace({ lotId });
      assert.equal(trace.origin.supplier.code, supplierCode);
    }
    const [balance] = await manager.query('SELECT SUM(quantity)::numeric AS quantity FROM stock_items WHERE product_id=$1', [product.id]);
    assert.equal(Number(balance.quantity), 8);
    return result.data.map((row) => ({ serial: row.serial, mode: row.serialMode, lotCode: row.lotCode, receiptCode: row.receiptCode, supplier: row.supplierName }));
  };
  console.log(JSON.stringify({ mode: commit ? 'commit' : 'preview', branch: { id: branch.id, name: branch.name }, marker: serialMarker, productCode, alreadySeeded: !!existing, manualSerials: manual, autoSerialCount: 3, lots: 2, imports: 2, totalAmount: 0, expiresAt: day(90) }, null, 2));
  if (existing) { console.log(JSON.stringify({ verifiedExisting: await verifySerials(db.manager) }, null, 2)); return; }
  if (!commit) return;
  const missing = await db.query(`SELECT t FROM unnest(ARRAY['stock_items','stock_lots']) t WHERE NOT has_table_privilege(t,'UPDATE')`);
  assert.equal(missing.length, 0, 'Missing stock UPDATE privilege');
  await db.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${serialMarker}:${branchId}`]);
    if (await manager.getRepository(E.Product).findOneBy({ branchId, code: productCode })) { await verifySerials(manager); return; }
    const units = await manager.getRepository(E.MeasurementUnit).findBy({ isActive: true });
    let unit = units.find((u) => ['hop', 'hộp', 'box'].includes(u.code.toLowerCase()) && Number(u.factorToBase) === 1);
    if (!unit) {
      const oldUnit = await manager.getRepository(E.MeasurementUnit).findOneBy({ code: 'DEMO-HOP' });
      assert.ok(!oldUnit || (oldUnit.isActive && Number(oldUnit.factorToBase) === 1 && oldUnit.dimension === 'COUNT'), 'Existing demo unit is incompatible');
      unit = oldUnit || await manager.getRepository(E.MeasurementUnit).save({ code: 'DEMO-HOP', name: 'Hộp mẫu', dimension: 'COUNT', factorToBase: 1, isActive: true });
    }
    const product = await manager.getRepository(E.Product).save({ branchId, categoryId: category.id, code: productCode, name: 'DEMO - Hộp hàng quản lý serial', description: `${serialMarker}: dữ liệu mẫu, không phải hàng kinh doanh`, productType: 'MERCHANDISE', lotTrackingEnabled: true, isFreshFood: false, isCanteenItem: false, isBoarding: false, unit: unit.code, baseUnitId: unit.id, isActive: true, price: 0, costPrice: 0 });
    const service = voucherService(manager);
    for (const [mode, quantity] of [['MANUAL', 5], ['AUTO', 3]]) {
      await service.createVoucher({ type: 'IMPORT', branchId, reasonCode: 'NHNCC', sourceType: 'SUPPLIER', sourceId: supplier.id, paymentStatus: 'DEBT', purchasedAt: today, requestId: requestId(`${serialMarker}-${mode}`), note: `${serialMarker}: nhập mẫu serial ${mode}, giá trị 0`, items: [{ productId: product.id, quantity, unitPrice: 0, lotCode: `${serialMarker}-${mode}`, manufacturedAt: today, expiresAt: day(90), serialMode: mode, ...(mode === 'MANUAL' ? { serials: manual } : {}) }] }, manager);
    }
    await verifySerials(manager);
  });
  console.log(JSON.stringify({ committed: true, verified: await verifySerials(db.manager) }, null, 2));
}

(async () => {
  db.setOptions({ synchronize: false, migrationsRun: false, logging: false, extra: { connectionTimeoutMillis: 5000 } });
  await db.initialize();
  try {
    if (process.argv.includes('--serials')) { await seedSerialDemo(); return; }
    const branch = await db.getRepository(E.Branch).findOneByOrFail({ id: branchId });
    const units = await db.getRepository(E.MeasurementUnit).findBy({ isActive: true });
    const kg = units.find((u) => u.code.toLowerCase() === 'kg');
    const litre = units.find((u) => ['l','lit','liter','litre'].includes(u.code.toLowerCase()));
    assert.ok(kg && litre, 'Requires active kg and litre measurement units');
    const reason = await db.getRepository(E.StockFundReceiptReason).findOneBy({ code: 'NHNNL', isDebt: true, status: 'active' });
    assert.ok(reason, 'NHNNL debt reason must already exist');
    const existing = await db.getRepository(E.Supplier).findOneBy({ code: supplierCode });
    console.log(JSON.stringify({ mode: commit ? 'commit' : 'preview', branch: { id: branch.id, name: branch.name }, marker, alreadySeeded: !!existing, products: ['DEMO-HEO','DEMO-GAO','DEMO-DAU'], supplierCount: 1, importCount: 6, exportCount: 2, totalAmount: 0, lots: plan.map((i) => ({ code: `${marker}-${i.key}`, imported: i.quantity, exported: i.consume || 0, remaining: i.quantity-(i.consume||0), expiresAt: day(i.expiry) })) }, null, 2));
    if (existing) { console.log(JSON.stringify({ verifiedExisting: await verify(db.manager) }, null, 2)); return; }
    if (!commit) return;
    const privileges = await db.query(`SELECT t FROM unnest(ARRAY['stock_items','stock_lots']) t WHERE NOT has_table_privilege(t,'UPDATE')`);
    assert.equal(privileges.length, 0, `Missing UPDATE privilege: ${privileges.map((r) => r.t).join(', ')}`);
    await db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${marker}:${branchId}`]);
      if (await manager.getRepository(E.Supplier).findOneBy({ code: supplierCode })) return;
      const category = await manager.getRepository(E.Category).save({ branchId, name: 'DEMO - Nguyên liệu truy xuất', status: 'active' });
      const supplier = await manager.getRepository(E.Supplier).save({ branchId, code: supplierCode, name: 'DEMO - Nhà cung cấp nguyên liệu', note: `${marker}: dữ liệu mẫu truy xuất, giá trị 0`, status: 'active' });
      const products = {};
      for (const [key, name, unit, fresh] of [['HEO','DEMO - Thịt heo',kg,true],['GAO','DEMO - Gạo',kg,false],['DAU','DEMO - Dầu ăn',litre,false]]) {
        assert.equal(await manager.getRepository(E.Product).countBy({ branchId, code: `DEMO-${key}` }), 0, 'Existing demo code must be reviewed');
        products[key] = await manager.getRepository(E.Product).save({ branchId, categoryId: category.id, code: `DEMO-${key}`, name, description: `${marker}: dữ liệu mẫu, không phải hàng kinh doanh`, unit: unit.code, baseUnitId: unit.id, productType: 'INGREDIENT', lotTrackingEnabled: true, isFreshFood: fresh, isCanteenItem: false, isBoarding: false, isActive: true, price: 0, costPrice: 0 });
      }
      const service = voucherService(manager);
      for (const item of plan) {
        const product = products[item.product];
        const lotCode = `${marker}-${item.key}`;
        await service.createVoucher({ type: 'IMPORT', purpose: 'MATERIAL_IMPORT', branchId, reasonCode: 'NHNNL', sourceType: 'SUPPLIER', sourceId: supplier.id, paymentStatus: 'DEBT', purchasedAt: day(item.bought), requestId: requestId(`import-${item.key}`), note: `${marker}: nhập mẫu ${lotCode}, giá trị 0`, items: [{ productId: product.id, quantity: item.quantity, unitPrice: 0, lotCode, manufacturedAt: day(item.bought), expiresAt: day(item.expiry), serialMode: 'NONE' }] }, manager);
        if (item.consume) {
          const stock = await manager.getRepository(E.Stock).findOneByOrFail({ branchId });
          const lot = await manager.getRepository(E.StockLot).findOneByOrFail({ stockId: stock.id, productId: product.id, lotCode });
          await service.createVoucher({ type: 'EXPORT', branchId, requestId: requestId(`export-${item.key}`), referenceType: 'DEMO_TRACE', note: `${marker}: xuất dùng mẫu, không phải giao dịch bán hàng`, items: [{ productId: product.id, quantity: item.consume, unitPrice: 0, allocations: [{ lotId: lot.id, quantity: item.consume }] }] }, manager);
        }
      }
      await verify(manager);
    });
    console.log(JSON.stringify({ committed: true, verified: await verify(db.manager) }, null, 2));
  } finally { await db.destroy(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
