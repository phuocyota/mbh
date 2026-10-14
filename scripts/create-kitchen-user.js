require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

async function main() {
  const email = process.env.KITCHEN_EMAIL || 'kitchen@mbh.com';
  const password = process.env.KITCHEN_PASSWORD;
  if (!password) throw new Error('Set KITCHEN_PASSWORD before running this script.');
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.DB_NAME,
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
  });
  let transaction = false;
  try {
    await client.connect();
    await client.query('BEGIN');
    transaction = true;
    const branches = await client.query(
      "SELECT id, name FROM branches WHERE status = 'ACTIVE' AND ($1::uuid IS NULL OR id = $1::uuid) FOR SHARE",
      [process.env.KITCHEN_BRANCH_ID || null],
    );
    if (branches.rowCount !== 1) {
      throw new Error(`Set KITCHEN_BRANCH_ID to an active branch. Found ${branches.rowCount} matching branches.`);
    }
    const branch = branches.rows[0];
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount) throw new Error('Email already exists; no existing account was changed.');
    const userId = randomUUID();
    const employeeId = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      "INSERT INTO users (id, full_name, email, password_hash, role, status, branch_id) VALUES ($1, $2, $3, $4, 'KITCHEN', 'ACTIVE', $5)",
      [userId, 'Nhân viên bếp', email, hash, branch.id],
    );
    await client.query(
      "INSERT INTO employees (id, user_id, code, full_name, branch_id, status) VALUES ($1, $2, $3, $4, $5, 'working')",
      [employeeId, userId, `KITCHEN-${userId}`, 'Nhân viên bếp', branch.id],
    );
    const check = await client.query(
      'SELECT u.email, u.role, u.status, u.branch_id, u.password_hash, e.id AS employee_id, e.status AS employee_status FROM users u JOIN employees e ON e.user_id = u.id AND e.branch_id = u.branch_id WHERE u.id = $1',
      [userId],
    );
    const row = check.rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash)) || row.employee_status !== 'working') {
      throw new Error('Created account verification failed.');
    }
    await client.query('COMMIT');
    transaction = false;
    console.log(JSON.stringify({ userId, email, role: row.role, status: row.status, branchId: branch.id, branchName: branch.name, employeeId, passwordVerified: true }, null, 2));
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.code || error.name, error.message);
  process.exitCode = 1;
});
