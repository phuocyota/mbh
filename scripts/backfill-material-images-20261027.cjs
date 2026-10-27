// Preview: node scripts/backfill-material-images-20261027.cjs
// Apply:   node scripts/backfill-material-images-20261027.cjs --commit
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const plan = require('./data/material-images-20261027.json');
const commit = process.argv.includes('--commit');
const backup = '/private/tmp/mbh-material-images-20261027-before.json';
(async () => {
  const c = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE || process.env.DB_NAME, connectionTimeoutMillis: 7000 });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query("SET LOCAL lock_timeout='5s'");
    const { rows } = await c.query(`SELECT p.id,p.branch_id,p.code,p.name,p.product_type,p.is_active,p.image_url
      FROM products p WHERE p.id=ANY($1::uuid[]) ORDER BY p.id FOR UPDATE`, [plan.items.map(p => p.id)]);
    assert.equal(rows.length, plan.items.length, 'Target products changed');
    const branch = await c.query('SELECT name FROM branches WHERE id=$1', [plan.branchId]);
    assert.equal(branch.rows[0]?.name, plan.branchName, 'Target branch changed');
    for (const item of plan.items) {
      const row = rows.find(p => p.id === item.id);
      assert.equal(row.branch_id, plan.branchId); assert.equal(row.code, item.code); assert.equal(row.name, item.name);
      assert.ok(['INGREDIENT','FUEL'].includes(row.product_type)); assert.equal(row.is_active, true);
      assert.ok(!row.image_url?.trim() || row.image_url === item.imageUrl, 'Existing photo changed; refuse overwrite');
    }
    if (commit) {
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify({ branchId: plan.branchId, rows }, null, 2), { mode: 0o600, flag: 'wx' });
      for (const item of plan.items) {
        await c.query(`UPDATE products SET image_url=$1,updated_at=NOW(),updated_by=$2
          WHERE id=$3 AND branch_id=$4 AND NULLIF(BTRIM(image_url),'') IS NULL`,
          [item.imageUrl, 'backfill:material-images:20261027', item.id, plan.branchId]);
      }
      const check = await c.query('SELECT id,image_url FROM products WHERE id=ANY($1::uuid[])', [plan.items.map(p=>p.id)]);
      for (const item of plan.items) assert.equal(check.rows.find(p=>p.id===item.id).image_url,item.imageUrl);
      await c.query('COMMIT');
    } else await c.query('ROLLBACK');
    const persisted = await c.query('SELECT id,name,image_url FROM products WHERE id=ANY($1::uuid[]) ORDER BY name',[plan.items.map(p=>p.id)]);
    console.log(JSON.stringify({ mode:commit?'COMMITTED':'PREVIEW',branch:plan.branchName,count:rows.length,backup:commit?backup:null,products:persisted.rows },null,2));
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { await c.end(); }
})().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
