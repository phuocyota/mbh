// User-authorized removal of exactly 100 unallocated legacy notebooks.
// Preview unless --commit. A completed stock-take retains the adjustment audit.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const productId = '697cfa63-c8a1-4801-9db8-3a33330e268b';
const branchId = '4a3ce246-0adb-4b06-8065-71714eeab9c7';
const lotId = '0c6c13dc-0067-460d-8244-ba04a43c4e5c';
const code = 'KK-REPAIR-TAP-20261021';
const actor = 'repair:remove-100-legacy-notebooks';
const note = 'Theo yêu cầu chủ hệ thống: loại bỏ 100 quyển Tập tồn cũ chưa rõ nguồn; giữ nguyên 10 quyển thuộc phiếu NK1792544741345 và lô LO-9284e3b2-141f-41db-9511-0250f92c5e5f.';
const c = new Client({ host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE,connectionTimeoutMillis:7000 });
(async()=>{
 try {
  await c.connect(); await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='5s'"); await c.query("SET LOCAL statement_timeout='20s'");
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['stock-branch:'+branchId]);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['stock-product:'+productId]);
  const [p] = (await c.query('SELECT * FROM products WHERE id=$1 AND code=$2 FOR UPDATE',[productId,'SP000009'])).rows; assert.ok(p);
  const balances=(await c.query('SELECT si.*,s.branch_id FROM stock_items si JOIN stocks s ON s.id=si.stock_id WHERE si.product_id=$1 FOR UPDATE OF si',[productId])).rows;
  assert.equal(balances.length,1); const b=balances[0]; assert.equal(b.branch_id,branchId);
  const lots=(await c.query('SELECT * FROM stock_lots WHERE product_id=$1 FOR UPDATE',[productId])).rows;
  assert.equal(lots.length,1); assert.equal(lots[0].id,lotId); assert.equal(Number(lots[0].quantity),10); assert.equal(lots[0].stock_id,b.stock_id);
  const old=(await c.query('SELECT * FROM stock_takes WHERE code=$1',[code])).rows;
  let takeId;
  if(old.length){
   assert.equal(old.length,1); assert.equal(old[0].status,'COMPLETED'); assert.equal(Number(b.quantity),10); assert.equal(p.lot_tracking_enabled,true);
   takeId=old[0].id;
   const items=(await c.query('SELECT * FROM stock_take_items WHERE stock_take_id=$1',[takeId])).rows;
   assert.equal(items.length,1); assert.equal(items[0].product_id,productId); assert.equal(Number(items[0].difference_quantity),-100);
  } else {
   assert.equal(Number(b.quantity),110,'stop if stock changed since preview'); assert.equal(p.lot_tracking_enabled,false);
   takeId=randomUUID(); const cost=Number(p.cost_price || p.price || 0);
   await c.query(`INSERT INTO stock_takes(id,branch_id,code,status,counted_at,total_difference_amount,increase_quantity,decrease_quantity,note,created_by,updated_by)
     VALUES($1,$2,$3,'COMPLETED',now(),$4,0,100,$5,$6,$6)`,[takeId,branchId,code,-100*cost,note,actor]);
   await c.query(`INSERT INTO stock_take_items(id,stock_take_id,product_id,system_quantity,actual_quantity,difference_quantity,unit_cost,difference_amount,note,created_by,updated_by)
     VALUES($1,$2,$3,110,10,-100,$4,$5,$6,$7,$7)`,[randomUUID(),takeId,productId,cost,-100*cost,note,actor]);
   await c.query(`INSERT INTO stock_movements(id,stock_id,product_id,lot_id,reference_id,quantity,created_by,updated_by)
     VALUES($1,$2,$3,NULL,$4,-100,$5,$5)`,[randomUUID(),b.stock_id,productId,takeId,actor]);
   await c.query('UPDATE stock_items SET quantity=10,updated_at=now(),updated_by=$1 WHERE id=$2',[actor,b.id]);
   await c.query('UPDATE products SET lot_tracking_enabled=true,updated_at=now(),updated_by=$1 WHERE id=$2',[actor,productId]);
  }
  assert.deepEqual((await c.query('SELECT * FROM stock_lots WHERE product_id=$1',[productId])).rows,lots,'restored lot must remain unchanged');
  const totals=(await c.query('SELECT quantity FROM stock_items WHERE product_id=$1',[productId])).rows;assert.equal(Number(totals[0].quantity),10);
  const commit=process.argv.includes('--commit');await c.query(commit?'COMMIT':'ROLLBACK');
  console.log(JSON.stringify({committed:commit,product:'SP000009',removed:100,remaining:10,restoredLotQuantity:10,trackingEnabled:true,stockTakeId:takeId,stockTakeCode:code},null,2));
 } catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{await c.end();}
})().catch(e=>{console.error(JSON.stringify({error:e.message,code:e.code}));process.exitCode=1;});
