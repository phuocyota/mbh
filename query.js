const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: '160.250.132.143',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'mbh_db'
  });
  await client.connect();
  
  const cols = await client.query(`
    SELECT u.email, c.full_name, c.type 
    FROM users u
    JOIN customers c ON u.id = c.user_id
    LIMIT 10
  `);
  console.log('Users and Customers:', cols.rows);
  
  await client.end();
}
run().catch(console.error);
