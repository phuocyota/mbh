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
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'products'
  `);
  console.log('Columns:', cols.rows);
  
  await client.end();
}
run().catch(console.error);
