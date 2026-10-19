// Isolated PostgreSQL regression check. Never reads .env or connects to a server.
// npm install --prefix /tmp/mbh-warehouse-pgcheck --no-save --ignore-scripts @electric-sql/pglite
// WAREHOUSE_PGLITE_PATH=/tmp/mbh-warehouse-pgcheck/node_modules/@electric-sql/pglite node scripts/verify-warehouse-postgres.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { PGlite } = require(
  process.env.WAREHOUSE_PGLITE_PATH || '@electric-sql/pglite',
);
const { WarehouseService } = require(
  path.resolve(__dirname, '../dist/src/modules/stock/warehouse.service.js'),
);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

(async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE stocks(id uuid PRIMARY KEY,name text,branch_id uuid);
      CREATE TABLE products(id uuid PRIMARY KEY,code text,name text,product_type text,category_id uuid,unit text,base_unit_id uuid,minimum_stock numeric,cost_price numeric,lot_tracking_enabled boolean,is_active boolean,branch_id uuid);
      CREATE TABLE categories(id uuid PRIMARY KEY,name text);
      CREATE TABLE measurement_units(id uuid PRIMARY KEY,code text);
      CREATE TABLE stock_items(id uuid PRIMARY KEY,stock_id uuid,product_id uuid,quantity numeric);
      CREATE TABLE stock_lots(id uuid PRIMARY KEY,stock_id uuid,product_id uuid,lot_code text,manufactured_at date,expires_at date,quantity numeric);
      CREATE TABLE stock_movements(id uuid PRIMARY KEY,stock_id uuid,product_id uuid,lot_id uuid,reference_id uuid,quantity numeric,created_at timestamptz);
      CREATE TABLE stock_receipt_import(id uuid PRIMARY KEY,code text,branch_id uuid,status text);
      CREATE TABLE stock_receipt_export(id uuid PRIMARY KEY,code text,branch_id uuid,status text,reference_type text);
      CREATE TABLE stock_receipt_transfer(id uuid PRIMARY KEY,code text);
      CREATE TABLE stock_takes(id uuid PRIMARY KEY,code text);
      CREATE TABLE kitchen_production_batches(id uuid PRIMARY KEY);
      INSERT INTO stocks VALUES ('${uuid(11)}','Kho A','${uuid(1)}'),('${uuid(12)}','Kho B','${uuid(1)}'),('${uuid(13)}','Kho khác','${uuid(2)}');
      INSERT INTO categories VALUES ('${uuid(30)}','Nguyên liệu'),('${uuid(31)}','Hàng hóa');
      INSERT INTO measurement_units VALUES ('${uuid(40)}','kg'),('${uuid(41)}','chai');
      INSERT INTO products VALUES
        ('${uuid(21)}','NL01','Thịt','INGREDIENT','${uuid(30)}','kg','${uuid(40)}',5,100,true,true,'${uuid(1)}'),
        ('${uuid(22)}','HH01','Nước','MERCHANDISE','${uuid(31)}','chai','${uuid(41)}',NULL,20,false,true,'${uuid(1)}'),
        ('${uuid(23)}','NL02','Rau','INGREDIENT','${uuid(30)}','kg','${uuid(40)}',NULL,NULL,false,true,'${uuid(1)}'),
        ('${uuid(24)}','OTHER','Hàng chi nhánh khác','FUEL','${uuid(30)}','kg','${uuid(40)}',100,999,true,true,'${uuid(2)}');
      INSERT INTO stock_items VALUES ('${uuid(51)}','${uuid(11)}','${uuid(21)}',10),('${uuid(52)}','${uuid(12)}','${uuid(21)}',2),
        ('${uuid(53)}','${uuid(11)}','${uuid(22)}',100),('${uuid(54)}','${uuid(12)}','${uuid(23)}',3),
        ('${uuid(55)}','${uuid(13)}','${uuid(24)}',999);
      INSERT INTO stock_lots VALUES
        ('${uuid(61)}','${uuid(11)}','${uuid(21)}','A-EXPIRED',CURRENT_DATE-5,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-1,3),
        ('${uuid(62)}','${uuid(11)}','${uuid(21)}','A-FRESH',CURRENT_DATE-1,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+2,7),
        ('${uuid(63)}','${uuid(12)}','${uuid(21)}','B-FRESH',CURRENT_DATE,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7,2),
        ('${uuid(64)}','${uuid(13)}','${uuid(24)}','FOREIGN',CURRENT_DATE-5,CURRENT_DATE-1,999);
      INSERT INTO stock_receipt_import VALUES ('${uuid(71)}','NK1','${uuid(1)}','COMPLETED'),('${uuid(72)}','NK2','${uuid(1)}','DRAFT'),('${uuid(73)}','NK3','${uuid(2)}','DRAFT');
      INSERT INTO stock_receipt_export VALUES ('${uuid(74)}','XKB1','${uuid(1)}','COMPLETED','kitchen_consumption_session'),('${uuid(75)}','XK2','${uuid(1)}','DRAFT',NULL);
      INSERT INTO stock_takes VALUES ('${uuid(76)}','KK1');
      INSERT INTO kitchen_production_batches VALUES ('${uuid(77)}');
      INSERT INTO stock_movements VALUES
        ('${uuid(81)}','${uuid(11)}','${uuid(21)}','${uuid(62)}','${uuid(71)}',10,now()-interval '1 day'),
        ('${uuid(82)}','${uuid(11)}','${uuid(21)}','${uuid(62)}','${uuid(77)}',-2,now()),
        ('${uuid(83)}','${uuid(11)}','${uuid(21)}','${uuid(62)}','${uuid(74)}',-1,now()),
        ('${uuid(84)}','${uuid(12)}','${uuid(21)}','${uuid(63)}','${uuid(76)}',-1,now()),
        ('${uuid(85)}','${uuid(11)}','${uuid(22)}',NULL,'${uuid(71)}',100,now()-interval '1 day'),
        ('${uuid(86)}','${uuid(13)}','${uuid(24)}','${uuid(64)}','${uuid(73)}',999,now());
    `);
    const adapter = {
      query: async (sql, params) => (await pg.query(sql, params)).rows,
      transaction: async (_level, fn) =>
        pg.transaction((tx) =>
          fn({
            query: async (sql, params) => (await tx.query(sql, params)).rows,
          }),
        ),
    };
    const service = new WarehouseService(adapter);
    const branch = uuid(1);
    const all = await service.inventory(branch, { size: 2 });
    assert.equal(all.total, 6);
    assert.equal(all.data.length, 2);
    assert.equal(all.reservationsSupported, false);
    assert.ok(all.data.every((r) => r.reservedQuantity === null));
    const last = await service.inventory(branch, { page: 99 });
    assert.equal(last.total, 6);
    assert.deepEqual(last.data, []);
    const expired = await service.inventory(branch, { status: 'EXPIRED' });
    assert.equal(expired.total, 1);
    assert.equal(expired.data[0].availableQuantity, 7);
    assert.equal(expired.data[0].expiredQuantity, 3);
    const low = await service.inventory(branch, {
      status: 'LOW',
      stockId: uuid(12),
    });
    assert.equal(low.total, 1);
    assert.equal(low.data[0].quantity, 2);
    const lots = await service.inventory(branch, { lotCode: 'B-FRESH' });
    assert.equal(lots.total, 1);
    assert.equal(lots.data[0].stockId, uuid(12));
    assert.equal(
      (
        await service.inventory(branch, {
          search: 'Thịt',
          productType: 'INGREDIENT',
        })
      ).total,
      2,
    );
    assert.equal(
      (await service.inventory(branch, { search: "' OR 1=1 --" })).total,
      0,
    );
    assert.equal(
      (await service.inventory(branch, { categoryId: uuid(31) })).total,
      2,
    );
    assert.equal(
      (await service.inventory(branch, { stockId: uuid(13) })).total,
      0,
    );
    const [[clock]] = await Promise.all([
      adapter.query(
        `SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today,((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-1)::text AS yesterday`,
      ),
    ]);
    assert.equal(
      (
        await service.inventory(branch, {
          expiresFrom: clock.today,
          expiresTo: clock.today,
        })
      ).total,
      0,
    );
    const overview = await service.overview(branch, {
      from: clock.yesterday,
      to: clock.today,
    });
    assert.equal(overview.summary.totalProducts, 3);
    assert.equal(Number(overview.summary.inventoryValue), 3200);
    assert.equal(overview.summary.missingCostRows, 1);
    assert.equal(overview.summary.lowStockProducts, 1);
    assert.equal(overview.summary.activeLots, 2);
    assert.equal(overview.summary.expiringLots, 2);
    assert.equal(overview.summary.expiredLots, 1);
    assert.equal(overview.summary.pendingImports, 1);
    assert.equal(overview.summary.pendingExports, 1);
    assert.deepEqual(
      overview.quantityByUnit.map((r) => [r.unit, Number(r.quantity)]),
      [
        ['chai', 100],
        ['kg', 15],
      ],
    );
    assert.equal(Number(overview.consumption[0].quantity), 3);
    assert.deepEqual(
      overview.valueHistory.map((r) => Number(r.value)),
      [3600, 3200],
    );
    assert.equal(overview.expiringLots.length, 3);
    assert.equal(
      overview.expiryDistribution.reduce((n, r) => n + r.lots, 0),
      2,
    );
    const detail = await service.detail(branch, uuid(21), { size: 2 });
    assert.equal(detail.warehouses.length, 2);
    assert.equal(detail.lots.length, 3);
    assert.equal(detail.movements.total, 4);
    assert.equal(detail.movements.data.length, 2);
    const adjustments = await service.detail(branch, uuid(21), {
      historyKind: 'ADJUSTMENT',
    });
    assert.equal(adjustments.movements.total, 1);
    assert.equal(adjustments.movements.data[0].referenceCode, 'KK1');
    await assert.rejects(
      service.detail(branch, uuid(24), {}),
      /Không tìm thấy/,
    );
    assert.equal((await service.stocks(branch)).length, 2);
    if (process.env.WAREHOUSE_FIXTURE_OUTPUT) {
      require('node:fs').writeFileSync(process.env.WAREHOUSE_FIXTURE_OUTPUT, JSON.stringify({
        overview, inventory: await service.inventory(branch, { size: 100 }),
        detail: await service.detail(branch, uuid(21), {}), stocks: await service.stocks(branch),
      }));
    }
    console.log(
      'PASS: isolated PostgreSQL warehouse checks (real SQL, branch isolation, totals, units, expiry, paging, filters, consumption, value reconstruction, adjustments).',
    );
  } finally {
    await pg.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
