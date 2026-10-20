// Isolated PostgreSQL/TypeORM check. Does not read .env or connect to any server.
// Run after npm run build: node scripts/verify-kitchen-task-flow.cjs
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { PGlite } = require(process.env.WAREHOUSE_PGLITE_PATH || '/tmp/mbh-warehouse-pgcheck/node_modules/@electric-sql/pglite');
const E = { ...require('../dist/src/entities'), ...require('../dist/src/entities/finished-unit.entity') };
const { KitchenTaskService } = require('../dist/src/modules/kitchen/kitchen-task.service');
const { KitchenService } = require('../dist/src/modules/kitchen/kitchen.service');
const { AddKitchenRecipeApproval1765100000000 } = require('../dist/src/migrations/1765100000000-AddKitchenRecipeApproval');
const { KitchenOperationsService } = require('../dist/src/modules/kitchen/kitchen-operations.service');
const { StockMovementService, localDate } = require('../dist/src/modules/stock/stock-movement.service');
const { SocketService } = require('../dist/src/modules/socket/socket.service');
const pg = new PGlite();
// pg-compatible in-process driver; every query runs in isolated PGlite.
class Pool extends EventEmitter {
  constructor() { super(); this.options = {}; }
  connect(callback) {
    const client = new EventEmitter(); client.release = () => {};
    client.query = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const result = pg.query(sql, params || []).then((r) => ({ rows: r.rows, fields: r.fields, rowCount: r.affectedRows || r.rows.length }));
      if (cb) { result.then((r) => cb(null, r), cb); return; }
      return result;
    };
    if (callback) return callback(null, client, () => {});
    return Promise.resolve(client);
  }
  end(callback) { callback?.(); return Promise.resolve(); }
}
(async () => {
  const db = new DataSource({ type: 'postgres', driver: { ...require('pg'), Pool }, entities: [path.resolve(__dirname, '../dist/src/entities/*.entity.js')], synchronize: true, installExtensions: false, uuidExtension: 'pgcrypto', logging: false });
  try {
    await db.initialize();
    const save = (entity, value) => db.getRepository(entity).save(value);
    const branch = await save(E.Branch, { name: 'Isolated kitchen' });
    const category = await save(E.Category, { name: 'Dishes', branchId: branch.id });
    const user = await save(E.User, { fullName: 'Test operator', role: 'KITCHEN', branchId: branch.id, passwordHash: 'not-a-login' });
    const actor = { userId: user.id, userType: 'KITCHEN', branchId: branch.id };
    const piece = await save(E.MeasurementUnit, { code: 'piece', name: 'Cái', dimension: 'COUNT', factorToBase: 1 });
    const gram = await save(E.MeasurementUnit, { code: 'g', name: 'Gram', dimension: 'MASS', factorToBase: 1 });
    const dish = await save(E.Product, { name: 'Bánh mì', categoryId: category.id, branchId: branch.id, productType: 'FINISHED_GOOD', requiresCooking: true, requiresSample: true, baseUnitId: piece.id, unit: 'ổ', price: 20000, recommendedUseMinutes: 120 });
    const stock = await save(E.Stock, { name: 'Kho test', branchId: branch.id });
    const inputs = [];
    for (const [name, quantity, unit, requirement, issued] of [['Vỏ bánh', 5, piece, 1, 1], ['Chả', 500, gram, 50, 60], ['Rau', 200, gram, 20, 25]]) {
      const product = await save(E.Product, { name, categoryId: category.id, branchId: branch.id, productType: 'INGREDIENT', baseUnitId: unit.id, lotTrackingEnabled: true, unit: unit.code, price: 0 });
      const lot = await save(E.StockLot, { stockId: stock.id, productId: product.id, lotCode: name, expiresAt: '2099-01-01', quantity });
      await save(E.StockItem, { stockId: stock.id, productId: product.id, quantity });
      inputs.push({ product, lot, quantity, unit, requirement, issued });
    }
    const recipe = await save(E.KitchenRecipe, { branchId: branch.id, productId: dish.id, version: 1, status: 'ACTIVE', yieldQuantity: 1, yieldUnitId: piece.id, description: 'Vỏ bánh, chả và rau' });
    for (const input of inputs) await save(E.KitchenRecipeItem, { recipeId: recipe.id, ingredientProductId: input.product.id, unitId: input.unit.id, quantity: input.requirement });
    // Exercise the actual migration against the prior schema in this isolated DB.
    await db.query('ALTER TABLE kitchen_recipes DROP COLUMN approval, DROP COLUMN expected_waste_percent');
    const migration = new AddKitchenRecipeApproval1765100000000(), runner = db.createQueryRunner();
    await migration.up(runner);
    assert.equal((await db.getRepository(E.KitchenRecipe).findOneByOrFail({ id: recipe.id })).approval.legacy, true);
    await runner.release();
    const order = await save(E.Order, { branchId: branch.id, orderCode: 'ISOLATED-TEST', orderNumber: 1, status: 1, paymentStatus: 'PAID', paidAmount: 20000, totalAmount: 20000 });
    const ticket = await save(E.KitchenOrderTicket, { orderId: order.id, branchId: branch.id, status: 'WAITING' });
    await save(E.KitchenOrderTicketItem, { ticketId: ticket.id, productId: dish.id, productName: dish.name, quantity: 1 });
    const movements = new StockMovementService();
    const ops = new KitchenOperationsService(db, { get: () => undefined }, new SocketService(), movements);
    const kitchen = Object.assign(Object.create(KitchenService.prototype), {
      dataSource: db, recipes: db.getRepository(E.KitchenRecipe), units: db.getRepository(E.MeasurementUnit),
      products: db.getRepository(E.Product), operations: ops, movements,
    });
    const chef = { ...actor, userType: 'HEAD_CHEF' }, admin = { ...actor, userId: randomUUID(), userType: 'ADMIN' };
    for (const [index, costPrice] of [2000, 100, 50].entries()) await db.getRepository(E.Product).update(inputs[index].product.id, { costPrice });
    const recipeBody = { productId: dish.id, branchId: branch.id, yieldQuantity: 1, yieldUnitId: piece.id, expectedWastePercent: 5,
      items: inputs.map(input => ({ ingredientProductId: input.product.id, unitId: input.unit.id, quantity: input.requirement })) };
    await assert.rejects(kitchen.createRecipe(actor, recipeBody), /Chỉ bếp trưởng/);
    await assert.rejects(kitchen.createRecipe(chef, { ...recipeBody, activate: true }), /gửi duyệt/);
    const draft = await kitchen.createRecipe(chef, recipeBody);
    assert.equal(draft.status, 'DRAFT'); assert.equal(draft.version, 2);
    await assert.rejects(kitchen.activateRecipe(admin, draft.id), /Trạng thái/);
    await assert.rejects(kitchen.reviewRecipe({ ...chef, branchId: randomUUID() }, draft.id, 'submit'), /CROSS_BRANCH/);
    let review = await kitchen.reviewRecipe(chef, draft.id, 'submit');
    assert.equal(review.status, 'PENDING_REVIEW'); assert.equal(review.approval.costing.totalCost, 8000);
    assert.equal(review.approval.costing.estimatedWasteCost, 400);
    assert.equal((await db.getRepository(E.KitchenRecipe).findOneByOrFail({ id: recipe.id })).status, 'ACTIVE');
    await assert.rejects(kitchen.activateRecipe(chef, draft.id), /quyền/);
    await assert.rejects(kitchen.reviewRecipe({ ...chef, userType: 'MANAGER', branchId: randomUUID() }, draft.id, 'approve'), /CROSS_BRANCH/);
    await assert.rejects(kitchen.reviewRecipe(admin, draft.id, 'request-changes', '  '), /lý do/);
    review = await kitchen.reviewRecipe(admin, draft.id, 'request-changes', 'Kiểm tra hao hụt');
    assert.equal(review.status, 'REVISION_REQUESTED'); assert.equal(review.approval.reason, 'Kiểm tra hao hụt');
    await db.getRepository(E.Product).update(inputs[0].product.id, { costPrice: null });
    await assert.rejects(kitchen.reviewRecipe(chef, draft.id, 'submit'), /giá vốn/);
    await db.getRepository(E.Product).update(inputs[0].product.id, { costPrice: 2000 });
    review = await kitchen.reviewRecipe(chef, draft.id, 'submit');
    await db.getRepository(E.Product).update(inputs[1].product.id, { costPrice: 200 });
    const pending = (await kitchen.listRecipes(admin, branch.id, dish.id)).find(row => row.id === draft.id);
    assert.equal(pending.costing.totalCost, 8000, 'submitted cost remains pinned when product cost changes');
    review = await kitchen.reviewRecipe(admin, draft.id, 'approve');
    assert.equal(review.status, 'ACTIVE'); assert.equal(review.approval.approvedBy, admin.userId);
    assert.equal((await db.getRepository(E.KitchenRecipe).findOneByOrFail({ id: recipe.id })).status, 'INACTIVE');
    assert.equal((await kitchen.listRecipes(actor, branch.id)).length, 1, 'staff sees active approved recipe only');
    await assert.rejects(kitchen.reviewRecipe(admin, draft.id, 'approve'), /Trạng thái/);
    console.log('PASS isolated recipe approval: role/branch guards, draft → submit → request changes → resubmit → approve, cost conversion/snapshot, previous active preserved until approval.');
    const manager = { ...actor, userType: 'MANAGER' };
    for (const role of ['ADMIN', 'MANAGER', 'KITCHEN', 'CASHIER']) {
      await assert.rejects(kitchen.createRecipe({ ...actor, userType: role }, recipeBody), /Chỉ bếp trưởng/);
      await assert.rejects(kitchen.reviewRecipe({ ...actor, userType: role }, draft.id, 'submit'), /quyền/);
    }
    const chefDraft = await kitchen.createRecipe(chef, recipeBody);
    assert.ok((await kitchen.listRecipes(manager, branch.id)).some(row => row.id === chefDraft.id));
    await assert.rejects(kitchen.reviewRecipe({ ...chef, userId: randomUUID() }, chefDraft.id, 'submit'), /do bạn tạo/);
    await kitchen.reviewRecipe(chef, chefDraft.id, 'submit');
    await kitchen.reviewRecipe(manager, chefDraft.id, 'request-changes', 'Kiểm tra lại');
    await kitchen.reviewRecipe(chef, chefDraft.id, 'submit');
    assert.equal((await kitchen.activateRecipe(manager, chefDraft.id)).status, 'ACTIVE');
    await assert.rejects(kitchen.reviewRecipe({ ...manager, branchId: randomUUID() }, chefDraft.id, 'approve'), /CROSS_BRANCH/);
    console.log('PASS recipe separation: HEAD_CHEF authors/submits; ADMIN/MANAGER only review; manager cross-branch review rejected.');
    const tasks = new KitchenTaskService(db, ops, movements);
    let state = await tasks.get(actor, 'ticket', ticket.id);
    assert.equal(state.status, 'WAITING'); assert.equal(state.dishes[0].requirements.length, 3);
    await assert.rejects(tasks.get({ ...actor, branchId: randomUUID() }, 'ticket', ticket.id), /CROSS_BRANCH/);
    const act = (action, body, requestId = randomUUID(), version = state.version) => tasks.action(actor, 'ticket', ticket.id, action, { ...body, expectedVersion: version, requestId });
    await assert.rejects(act('start', {}), /trạng thái/);
    const receive = { dishes: [{ productId: dish.id, inputLots: inputs.map((input) => ({ lotId: input.lot.id, quantity: input.issued })) }] };
    const lotBefore = (await db.getRepository(E.StockLot).findOneByOrFail({ id: inputs[0].lot.id })).quantity;
    await db.getRepository(E.StockLot).update(inputs[0].lot.id, { expiresAt: '2000-01-01' });
    await assert.rejects(act('receive', receive), /hết hạn/);
    await db.getRepository(E.StockLot).update(inputs[0].lot.id, { expiresAt: '2099-01-01' });
    state = await act('receive', receive); assert.equal(state.status, 'RECEIVED');
    assert.equal(Number((await db.getRepository(E.StockLot).findOneByOrFail({ id: inputs[0].lot.id })).quantity), Number(lotBefore), 'receipt does not consume');
    const linkedBatch = state.batchIds[0];
    await assert.rejects(ops.transition(actor, linkedBatch, { expectedVersion: 2 }, 'PREPARING'), /Nhiệm vụ bếp/);
    await assert.rejects(tasks.action({ ...actor, userId: randomUUID() }, 'ticket', ticket.id, 'start', { expectedVersion: state.version, requestId: randomUUID() }), /nhân viên khác/);
    const startRequest = randomUUID(), oldVersion = state.version;
    state = await act('start', {}, startRequest); assert.equal(state.status, 'PREPARING');
    await tasks.action(actor, 'ticket', ticket.id, 'start', { expectedVersion: oldVersion, requestId: startRequest });
    assert.equal(await db.getRepository(E.StockMovement).count(), 3, 'replayed start must not consume twice');
    await assert.rejects(act('record', { actuals: [] }, randomUUID(), oldVersion), /phiên bản|cập nhật/);
    const actuals = [{ batchId: linkedBatch, quantity: 1, note: 'Hao hụt 5g chả', lots: inputs.map((input, index) => ({ lotId: input.lot.id, used: input.requirement, waste: index === 1 ? 5 : 0 })) }];
    await assert.rejects(act('record', { actuals: [{ ...actuals[0], lots: inputs.map(input => ({ lotId: input.lot.id, used: 0, waste: 0 })) }] }), /thực dùng/);
    state = await act('record', { actuals }); assert.equal(state.status, 'RECORDED');
    assert.equal(await db.getRepository(E.StockMovement).count(), 3, 'unused ingredients return only on confirmed completion');
    await assert.rejects(act('complete', { qualityPassed: true }), /SAMPLE_REQUIRED/);
    assert.equal((await tasks.get(actor, 'ticket', ticket.id)).status, 'RECORDED');
    assert.equal(await db.getRepository(E.StockMovement).count(), 3, 'failed QC rolls back all returns');
    const completeRequest = randomUUID(), completeVersion = state.version;
    const completeBody = { qualityPassed: true, samples: [{ batchId: linkedBatch, quantity: 10, unit: 'g', storageLocation: 'Tủ mẫu 1' }] };
    state = await act('complete', completeBody, completeRequest); assert.equal(state.status, 'COMPLETED');
    await tasks.action(actor, 'ticket', ticket.id, 'complete', { ...completeBody, requestId: completeRequest, expectedVersion: completeVersion });
    for (const [index, expected] of [4, 445, 180].entries()) assert.equal(Number((await db.getRepository(E.StockLot).findOneByOrFail({ id: inputs[index].lot.id })).quantity), expected);
    assert.equal(await db.getRepository(E.FinishedUnit).count(), 1);
    const inventories = await db.getRepository(E.KitchenOperation).findBy({ kind: 'finished-inventory' });
    assert.equal(inventories.length, 1); assert.equal(Number(inventories[0].payload.availableQuantity), 1);
    await assert.rejects(act('handover', { receivedBy: '', items: [{ batchId: linkedBatch, quantity: 1 }] }), /người nhận/);
    state = await act('handover', { receivedBy: 'Nhân viên giao món', receiverPlace: 'Quầy căn tin', items: [{ batchId: linkedBatch, quantity: 1 }] });
    assert.equal(state.status, 'HANDED_OVER'); assert.equal(state.history.length, 5);
    assert.equal((await db.getRepository(E.KitchenOrderTicket).findOneByOrFail({ id: ticket.id })).status, 'DELIVERED');
    assert.equal((await db.getRepository(E.Order).findOneByOrFail({ id: order.id })).status, 5);
    assert.equal((await db.getRepository(E.KitchenOperation).findOneByOrFail({ id: inventories[0].id })).payload.availableQuantity, 0);
    const list = await tasks.list(actor, { date: localDate() }); assert.equal(list.length, 1); assert.equal(list[0].status, 'HANDED_OVER');
    // The same flow also handles a planned batch, without an order ticket.
    const plan = await save(E.KitchenMealPlan, { branchId: branch.id, planDate: localDate(), mealPeriod: 'DINNER', status: 'LOCKED', createdBy: user.id });
    const planned = await save(E.KitchenProductionBatch, { mealPlanId: plan.id, productId: dish.id, plannedQuantity: 1, adjustmentQuantity: 0, shift: 'Ca chiều', source: 'MANUAL', status: 'WAITING', details: {} });
    state = await tasks.get(actor, 'batch', planned.id);
    const batchAction = (action, body) => tasks.action(actor, 'batch', planned.id, action, { ...body, expectedVersion: state.version, requestId: randomUUID() });
    state = await batchAction('receive', { dishes: [{ productId: dish.id, inputLots: inputs.map(input => ({ lotId: input.lot.id, quantity: input.requirement })) }] });
    await db.getRepository(E.StockLot).update(inputs[0].lot.id, { quantity: 0 });
    await assert.rejects(batchAction('start', {}), /STOCK|LOT|tồn|INSUFFICIENT/);
    assert.equal((await tasks.get(actor, 'batch', planned.id)).status, 'RECEIVED');
    await db.getRepository(E.StockLot).update(inputs[0].lot.id, { quantity: 4 });
    state = await batchAction('start', {});
    const batchActuals = [{ batchId: planned.id, quantity: 1, note: '', lots: inputs.map(input => ({ lotId: input.lot.id, used: input.requirement, waste: 0 })) }];
    state = await batchAction('record', { actuals: batchActuals });
    state = await batchAction('record', { actuals: batchActuals });
    state = await batchAction('complete', { qualityPassed: true, samples: [{ batchId: planned.id, quantity: 10, unit: 'g', storageLocation: 'Tủ mẫu' }] });
    state = await batchAction('handover', { receivedBy: 'Nhân viên phục vụ', items: [{ batchId: planned.id, quantity: 1 }] });
    assert.equal(state.status, 'HANDED_OVER');
    assert.equal((await tasks.list(actor, { date: localDate() })).length, 2);
    console.log('PASS isolated PostgreSQL: receive → start → actuals → sample/QC → handover; three lots, unused returns, stock once, replay, expiry, branch/owner/version checks, transaction rollback, finished units and order status.');
  } finally { if (db.isInitialized) await db.destroy(); await pg.close(); }
})().catch((error) => { console.error(error.stack); process.exit(1); });
