// Preview: node scripts/backfill-import-expiry.cjs --branch=<uuid>
// Apply the reviewed plan: add --commit. Existing expiry dates are preserved.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');

const branchId = process.argv.find((arg) => arg.startsWith('--branch='))?.slice(9);
assert.match(branchId || '', /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, '--branch=<uuid> required');
const commit = process.argv.includes('--commit');
const client = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  connectionTimeoutMillis: 5000,
});

async function run() {
  await client.connect();
  try {
    await client.query(commit ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'");
    const { rows: [branch] } = await client.query('SELECT id,name FROM branches WHERE id=$1', [branchId]);
    assert.ok(branch, 'Branch not found');
    const { rows } = await client.query(`
      SELECT d.id,d.input_details,r.code AS receipt,p.code AS product_code,p.name AS product_name,
        d.input_details->>'lotCode' AS lot_code,
        NULLIF(btrim(d.input_details->>'expiresAt'),'') AS existing_expiry,
        COALESCE(NULLIF(d.input_details->>'purchasedAt','')::timestamptz,r.created_at)::date::text AS purchase_date,
        (COALESCE(NULLIF(d.input_details->>'purchasedAt','')::timestamptz,r.created_at)::date + interval '3 months')::date::text AS default_expiry,
        COALESCE((SELECT jsonb_agg(to_jsonb(linked)) FROM (
          SELECT DISTINCT l.id,l.expires_at::text AS expiry
          FROM stock_movements m JOIN stock_lots l ON l.id=m.lot_id
          JOIN stocks s ON s.id=l.stock_id AND s.branch_id=r.branch_id
          WHERE m.reference_id=r.id AND m.product_id=d.product_id AND m.quantity>0
            AND l.product_id=d.product_id AND l.lot_code=d.input_details->>'lotCode'
        ) linked),'[]'::jsonb) AS lots
      FROM stock_receipt_detail d JOIN stock_receipt_import r ON r.id=d.import_id
      JOIN products p ON p.id=d.product_id
      WHERE r.branch_id=$1 AND r.status='COMPLETED' AND d.receipt_type='IMPORT'
      ORDER BY r.created_at,d.id ${commit ? 'FOR UPDATE OF d' : ''}`, [branchId]);

    const lotPlans = new Map();
    const details = [];
    for (const row of rows) {
      const known = [...new Set(row.lots.map((lot) => lot.expiry).filter(Boolean))];
      assert.ok(known.length <= 1, `Conflicting lot expiry dates for detail ${row.id}`);
      if (row.existing_expiry && known.length)
        assert.equal(row.existing_expiry, known[0], `Receipt/lot expiry mismatch for detail ${row.id}`);
      const expiry = row.existing_expiry || known[0] || row.default_expiry;
      assert.match(expiry || '', /^\d{4}-\d{2}-\d{2}$/, `Missing purchase date for detail ${row.id}`);
      if (!row.existing_expiry) details.push({ ...row, expiry });
      for (const lot of row.lots.filter((lot) => !lot.expiry)) {
        const previous = lotPlans.get(lot.id);
        assert.ok(!previous || previous.expiry === expiry, `Different import dates imply conflicting expiry for lot ${lot.id}`);
        lotPlans.set(lot.id, { id: lot.id, expiry, code: row.lot_code });
      }
    }
    const lots = [...lotPlans.values()];
    const { rows: [missing] } = await client.query(`SELECT count(*)::int total FROM stock_lots l JOIN stocks s ON s.id=l.stock_id WHERE s.branch_id=$1 AND l.expires_at IS NULL`, [branchId]);
    console.log(JSON.stringify({ mode: commit ? 'commit' : 'preview', branch,
      rule: '3 calendar months after purchase date; receipt creation date is the legacy fallback',
      missingReceiptDetails: details.length, lotsToUpdate: lots.length,
      unlinkedMissingLots: missing.total - lots.length,
      details: details.map((row) => ({ product: row.product_name, code: row.product_code, receipt: row.receipt, lot: row.lot_code, purchasedAt: row.purchase_date, expiresAt: row.expiry })),
    }, null, 2));
    if (!commit) { await client.query('ROLLBACK'); return; }

    const backupPath = `/tmp/mbh-expiry-backfill-${randomUUID()}.json`;
    writeFileSync(backupPath, JSON.stringify({ branchId, details: details.map((row) => ({ id: row.id, inputDetails: row.input_details })), lots }), { mode: 0o600 });
    for (const row of details) {
      const result = await client.query(`UPDATE stock_receipt_detail d SET input_details=jsonb_set(COALESCE(d.input_details,'{}'::jsonb),'{expiresAt}',to_jsonb($2::text),true)
        FROM stock_receipt_import r WHERE d.id=$1 AND r.id=d.import_id AND r.branch_id=$3
        AND NULLIF(btrim(d.input_details->>'expiresAt'),'') IS NULL RETURNING d.id`, [row.id, row.expiry, branchId]);
      assert.equal(result.rowCount, 1, 'Detail changed during backfill');
    }
    for (const lot of lots) {
      const result = await client.query(`UPDATE stock_lots l SET expires_at=$2::date FROM stocks s
        WHERE l.id=$1 AND s.id=l.stock_id AND s.branch_id=$3 AND l.expires_at IS NULL RETURNING l.id`, [lot.id, lot.expiry, branchId]);
      assert.equal(result.rowCount, 1, 'Lot changed during backfill');
    }
    const { rows: [verified] } = await client.query(`SELECT count(*)::int total FROM stock_receipt_detail WHERE id=ANY($1::uuid[]) AND NULLIF(input_details->>'expiresAt','') IS NOT NULL`, [details.map((row) => row.id)]);
    assert.equal(verified.total, details.length);
    await client.query('COMMIT');
    console.log(JSON.stringify({ committed: true, detailsUpdated: details.length, lotsUpdated: lots.length, backupPath }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
run().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
