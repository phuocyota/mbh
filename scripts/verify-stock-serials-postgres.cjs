// Isolated SQL regression. No .env and no remote database connection.
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.WAREHOUSE_PGLITE_PATH || '@electric-sql/pglite');
const { StockSerialService } = require('../dist/src/modules/stock/stock-serial.service');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
(async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(`
   CREATE TABLE products(id uuid,code text,name text);
   CREATE TABLE stocks(id uuid,name text,branch_id uuid);
   CREATE TABLE suppliers(id uuid,name text,branch_id uuid);
   CREATE TABLE stock_receipt_import(id uuid,code text,created_at timestamptz,status text,branch_id uuid,from_type text,from_id uuid);
   CREATE TABLE stock_receipt_detail(id uuid,product_id uuid,import_id uuid,receipt_type text,input_details jsonb);
   CREATE TABLE stock_lots(id uuid,product_id uuid,stock_id uuid);
   CREATE TABLE stock_movements(id uuid,reference_id uuid,product_id uuid,stock_id uuid,lot_id uuid,quantity numeric,created_at timestamptz);
   INSERT INTO products VALUES ('${id(1)}','P1','Máy mẫu');
   INSERT INTO stocks VALUES ('${id(2)}','Kho A','${id(3)}'),('${id(4)}','Kho B','${id(5)}');
   INSERT INTO suppliers VALUES ('${id(6)}','NCC A','${id(3)}');
   INSERT INTO stock_receipt_import VALUES ('${id(7)}','NK1',now(),'COMPLETED','${id(3)}','SUPPLIER','${id(6)}'),('${id(8)}','NK2',now(),'COMPLETED','${id(5)}',NULL,NULL),('${id(9)}','NK3',now(),'CANCELLED','${id(3)}',NULL,NULL);
   INSERT INTO stock_receipt_detail VALUES
    ('${id(10)}','${id(1)}','${id(7)}','IMPORT','{"serialMode":"MANUAL","serials":["SER-A","SER-B"],"lotCode":"LOT-A","purchasedAt":"2026-10-10","expiresAt":"2027-01-01"}'),
    ('${id(11)}','${id(1)}','${id(8)}','IMPORT','{"serialMode":"AUTO","serials":["FOREIGN"]}'),
    ('${id(12)}','${id(1)}','${id(9)}','IMPORT','{"serialMode":"AUTO","serials":["CANCELLED"]}'),
    ('${id(13)}','${id(1)}','${id(7)}','IMPORT','{"serials":null}'),
    ('${id(14)}','${id(1)}','${id(7)}','IMPORT','{"serials":{}}');
   INSERT INTO stock_lots VALUES ('${id(15)}','${id(1)}','${id(2)}');
   INSERT INTO stock_movements VALUES ('${id(16)}','${id(7)}','${id(1)}','${id(2)}','${id(15)}',2,now()),('${id(17)}','${id(7)}','${id(1)}','${id(2)}','${id(15)}',1,now());
  `);
  const service=new StockSerialService({query:async(sql,params)=>(await pg.query(sql,params)).rows});
  const list=await service.list(id(3),{size:1});
  assert.equal(list.total,3); assert.equal(list.data.length,1);
  const emptyPage=await service.list(id(3),{page:99,size:1});
  assert.equal(emptyPage.total,3);assert.deepEqual(emptyPage.data,[]);
  const matched=await service.list(id(3),{search:'ser-',serialMode:'MANUAL',receiptStatus:'COMPLETED',stockId:id(2),lotId:id(15)});
  assert.equal(matched.total,2);assert.ok(matched.data.every(r=>r.supplierName==='NCC A'));
  assert.equal((await service.list(id(3),{search:'FOREIGN'})).total,0);
  assert.equal((await service.list(id(3),{search:"' OR 1=1 --"})).total,0);
  assert.equal((await service.list(id(3),{serial:'SER-A'})).total,1);
  assert.equal((await service.list(id(3),{serial:'SER'})).total,0);
  const detail=await service.detail(id(3),id(10),2);assert.equal(detail.serial,'SER-B');assert.equal(detail.purchasedAt,'2026-10-10');assert.equal(detail.expiresAt,'2027-01-01');
  assert.equal(detail.serialMovementTrackingSupported,false);
  await assert.rejects(service.detail(id(5),id(10),1),/Không tìm thấy/);
  // Same lot and serial text on another receipt: provenance follows the
  // selected receipt detail, not the first inbound movement of the lot.
  await pg.exec(`
   INSERT INTO suppliers VALUES ('${id(18)}','NCC B','${id(3)}');
   INSERT INTO stock_receipt_import VALUES ('${id(19)}','NK-SECOND',now(),'COMPLETED','${id(3)}','SUPPLIER','${id(18)}');
   INSERT INTO stock_receipt_detail VALUES ('${id(20)}','${id(1)}','${id(19)}','IMPORT','{"serialMode":"MANUAL","serials":["SER-A"],"lotCode":"LOT-A"}');
   INSERT INTO stock_movements VALUES ('${id(21)}','${id(19)}','${id(1)}','${id(2)}','${id(15)}',1,now());
  `);
  const secondOrigin=await service.detail(id(3),id(20),1);
  assert.equal(secondOrigin.serial,'SER-A');
  assert.equal(secondOrigin.lotId,id(15));
  assert.equal(secondOrigin.receiptCode,'NK-SECOND');
  assert.equal(secondOrigin.supplierName,'NCC B');
  assert.equal((await service.detail(id(3),id(10),1)).supplierName,'NCC A');
  const {TraceLookupService}=require('../dist/src/modules/production-trace/trace-lookup.service');
  const adapter={query:async(sql,params)=>(await pg.query(sql,params)).rows};
  const resolver=new TraceLookupService(adapter,service,{getFullTrace:async({lotId})=>({lotId})});
  assert.equal((await resolver.lookup(id(3),id(15))).type,'LOT');
  assert.equal((await resolver.lookup(id(3),'SER-B')).serial.supplierName,'NCC A');
  await assert.rejects(resolver.lookup(id(5),'SER-B'),/Không tìm thấy/);
  await assert.rejects(resolver.lookup(id(3),'SER-A'),(e)=>e.getStatus()===409 && e.getResponse().total===2);
  await pg.exec(`INSERT INTO stock_receipt_detail VALUES ('${id(22)}','${id(1)}','${id(7)}','IMPORT','{"serialMode":"AUTO","serials":["${id(23)}"]}');`);
  assert.equal((await resolver.lookup(id(3),id(23))).type,'SERIAL');
  console.log('PASS: imported serial SQL, branch isolation, malformed legacy JSON, no join duplication, search/filters, per-serial receipt/supplier provenance, paging totals.');
 }finally{await pg.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
