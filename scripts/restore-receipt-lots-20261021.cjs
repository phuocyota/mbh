// Scoped repair for the two lots in NK1792544741345. Preview unless --commit.
// Never inserts receipts, changes stock totals, or writes financial records.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const branch = '4a3ce246-0adb-4b06-8065-71714eeab9c7';
const receipt = 'b143a0f3-917f-4fa4-bc69-fe8cc3f45490';
const marker = 'repair:NK1792544741345:lots';
const plan = [
  { productId: '61012961-9069-4850-b96a-5cc58a2908e1', code: 'SP000022', quantity: 15, lotCode: 'LO-a0e3435e-e29f-479d-aff2-73df364753e3' },
  { productId: '697cfa63-c8a1-4801-9db8-3a33330e268b', code: 'SP000009', quantity: 10, lotCode: 'LO-9284e3b2-141f-41db-9511-0250f92c5e5f' },
];
async function restore(c, commit = false) {
  await c.query('BEGIN');
  try {
    await c.query("SET LOCAL lock_timeout='5s'");
    await c.query("SET LOCAL statement_timeout='20s'");
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['stock-branch:' + branch]);
    for (const p of [...plan].sort((a,b) => a.productId.localeCompare(b.productId)))
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['stock-product:' + p.productId]);
    const { rows: headers } = await c.query('SELECT * FROM stock_receipt_import WHERE id=$1 AND branch_id=$2 AND code=$3 FOR UPDATE', [receipt, branch, 'NK1792544741345']);
    assert.equal(headers.length, 1, 'exact receipt and branch must exist');
    assert.equal(headers[0].status, 'COMPLETED');
    const result = [];
    for (const p of plan) {
      const { rows: products } = await c.query('SELECT * FROM products WHERE id=$1 AND code=$2 FOR UPDATE', [p.productId, p.code]);
      assert.equal(products.length, 1);
      const { rows: details } = await c.query("SELECT * FROM stock_receipt_detail WHERE import_id=$1 AND product_id=$2 AND receipt_type='IMPORT' FOR UPDATE", [receipt,p.productId]);
      assert.equal(details.length, 1);
      const d = details[0];
      assert.equal(Number(d.quantity), p.quantity);
      assert.equal(d.input_details.lotCode, p.lotCode);
      const { rows: movements } = await c.query('SELECT m.*,s.branch_id FROM stock_movements m JOIN stocks s ON s.id=m.stock_id WHERE m.reference_id=$1 AND m.product_id=$2 FOR UPDATE OF m', [receipt,p.productId]);
      assert.equal(movements.length, 1);
      const movement = movements[0];
      assert.equal(movement.branch_id, branch);
      assert.equal(Number(movement.quantity), p.quantity);
      const { rows: later } = await c.query('SELECT id FROM stock_movements WHERE stock_id=$1 AND product_id=$2 AND id<>$3 AND created_at >= $4', [movement.stock_id,p.productId,movement.id,movement.created_at]);
      assert.equal(later.length, 0, 'stop if any later movement makes remaining quantity uncertain');
      const { rows: balances } = await c.query('SELECT * FROM stock_items WHERE product_id=$1 ORDER BY stock_id FOR UPDATE', [p.productId]);
      const { rows: lots } = await c.query('SELECT * FROM stock_lots WHERE product_id=$1 FOR UPDATE', [p.productId]);
      let lot = lots.find(l => l.stock_id === movement.stock_id && l.lot_code === p.lotCode);
      if (lot) {
        assert.equal(Number(lot.quantity), p.quantity);
        assert.equal(movement.lot_id, lot.id, 'existing lot must already match movement');
      } else {
        assert.equal(movement.lot_id, null, 'movement must be unassigned');
        lot = { id: randomUUID(), stock_id: movement.stock_id, product_id: p.productId, lot_code: p.lotCode, quantity: p.quantity };
        await c.query(`INSERT INTO stock_lots(id,stock_id,product_id,lot_code,quantity,manufactured_at,expires_at,created_at,updated_at,created_by,updated_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$9)`,
          [lot.id,lot.stock_id,p.productId,p.lotCode,p.quantity,d.input_details.manufacturedAt || null,d.input_details.expiresAt || null,movement.created_at,marker]);
        const updated = await c.query('UPDATE stock_movements SET lot_id=$1,updated_at=now(),updated_by=$2 WHERE id=$3 AND lot_id IS NULL', [lot.id,marker,movement.id]);
        assert.equal(updated.rowCount, 1);
        lots.push(lot);
      }
      // The product-wide flag can only be enabled when ALL its warehouses balance.
      const unallocated = balances.map(b => ({ stockId:b.stock_id, quantity:Number(b.quantity)-lots.filter(l=>l.stock_id===b.stock_id).reduce((sum,l)=>sum+Number(l.quantity),0) }));
      assert.ok(unallocated.every(b=>b.quantity>=0), 'lot totals must not exceed stock totals');
      const complete = unallocated.every(b=>Math.abs(b.quantity)<0.00005);
      if (complete) await c.query('UPDATE products SET lot_tracking_enabled=true,updated_at=now(),updated_by=$1 WHERE id=$2', [marker,p.productId]);
      else assert.equal(products[0].lot_tracking_enabled, false, 'partially allocated product must not already be flagged');
      const { rows: after } = await c.query('SELECT * FROM stock_items WHERE product_id=$1 ORDER BY stock_id', [p.productId]);
      assert.deepEqual(after, balances, 'stock totals and their metadata must remain untouched');
      result.push({ product:p.code, name:products[0].name, lotId:lot.id, lotCode:p.lotCode, restoredQuantity:p.quantity, trackingEnabled:complete, unallocated });
    }
    const { rows: headerAfter } = await c.query('SELECT * FROM stock_receipt_import WHERE id=$1', [receipt]);
    assert.deepEqual(headerAfter[0], headers[0], 'receipt, amount and status must remain untouched');
    await c.query(commit ? 'COMMIT' : 'ROLLBACK');
    return { committed:commit, receipt:'NK1792544741345', result };
  } catch (error) { await c.query('ROLLBACK'); throw error; }
}
module.exports = { restore };
if (require.main === module) {
  const c = new Client({ host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE,connectionTimeoutMillis:7000 });
  (async()=>{ try { await c.connect(); console.log(JSON.stringify(await restore(c,process.argv.includes('--commit')),null,2)); } finally { await c.end(); } })().catch(e=>{console.error(JSON.stringify({error:e.message,code:e.code}));process.exitCode=1;});
}
