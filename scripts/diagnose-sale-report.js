// Read-only diagnostic. Run in the deployed backend directory so .env matches the API.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const code = process.argv[2];
  if (!/^XK\d+$/.test(code || '')) {
    throw new Error('Usage: node scripts/diagnose-sale-report.js XK1792371266858');
  }
  const reportsDir = ['../dist/src/modules/reports', '../dist/modules/reports']
    .map(directory => path.join(__dirname, directory))
    .find(directory => fs.existsSync(path.join(directory, 'reports.service.js')))
    || path.join(__dirname, '../dist/src/modules/reports');
  const servicePath = path.join(reportsDir, 'reports.service.js');
  const helperPath = path.join(reportsDir, 'direct-sales-report.js');
  const service = fs.existsSync(servicePath) ? fs.readFileSync(servicePath, 'utf8') : '';
  console.log('Compiled backend in this directory includes direct sales:', service.includes('getDirectSales') && fs.existsSync(helperPath));
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'pos_system',
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(`
      SELECT e.id, e.code, e.branch_id, b.name AS branch_name, e.status, e.reason_code,
        e.created_by, u.full_name AS actor_name, u.role AS actor_role, u.branch_id AS actor_branch_id,
        c.full_name AS customer_name,
        e.reference_type, e.reference_id, e.total_amount,
        TO_CHAR(e.created_at AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS business_date,
        (SELECT count(*)::int FROM stock_receipt_detail d WHERE d.export_id=e.id) AS detail_count,
        EXISTS(SELECT 1 FROM orders o WHERE o.id=e.reference_id) AS linked_order,
        (SELECT count(*)::int FROM money_vouchers m WHERE m.ref_id=e.id AND m.type='RECEIPT') AS receipt_count
      FROM stock_receipt_export e LEFT JOIN branches b ON b.id=e.branch_id
      LEFT JOIN users u ON u.id::text=e.created_by
      LEFT JOIN customers c ON c.id=e.to_id
      WHERE e.code=$1
    `, [code]);
    if (!rows.length) {
      console.log('Voucher not found in the database used by this process.');
      return;
    }
    console.table(rows);
    if (fs.existsSync(helperPath)) {
      const { DIRECT_SALES_SQL } = require(helperPath);
      const { resolveEndOfDayRange } = require(path.join(reportsDir, 'end-of-day-range.js'));
      const row = rows[0];
      const { from, to } = resolveEndOfDayRange({ from: row.business_date, to: row.business_date });
      const result = await client.query(DIRECT_SALES_SQL, [from.toISOString(), to.toISOString(), row.branch_id]);
      const matches = result.rows.filter(item => item.voucherId === row.id);
      console.log('Rows matched by this compiled direct-sales query:', matches.length);
      console.log('Matched sales total:', matches.reduce((sum, item) => sum + Number(item.total), 0));
      console.table(matches.map(item => ({ productCode: item.code, productName: item.name, quantity: item.qty, total: item.total })));
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Diagnostic failed:', error.code || error.message);
  process.exitCode = 1;
});
