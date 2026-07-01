const { Client } = require('pg');
const crypto = require('crypto');

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function seed() {
  const client = new Client({
    host: '160.250.132.143',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'mbh_db'
  });
  await client.connect();
  
  try {
    // Get product ID for Cơm thịt kho trứng
    const resProduct = await client.query('SELECT id FROM products WHERE is_canteen_item = false LIMIT 1');
    if (resProduct.rows.length === 0) {
      console.log('No boarding product found!');
      return;
    }
    const productId = resProduct.rows[0].id;

    // Get all branches
    const resBranches = await client.query("SELECT id FROM branches");
    const branches = resBranches.rows.map(r => r.id);

    // Get this week's dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push({
        dateKey: formatDate(d),
        dayOfWeek: d.getDay()
      });
    }

    const levels = [
      { name: 'preschool', meals: ['BREAKFAST', 'LUNCH', 'AFTERNOON'] },
      { name: 'primary', meals: ['LUNCH', 'AFTERNOON'] }
    ];

    // Clear existing for these dates
    const dateKeys = dates.map(d => d.dateKey);
    await client.query('DELETE FROM meal_items WHERE date_key = ANY($1)', [dateKeys]);
    console.log('Deleted existing meal items for this week.');

    // Insert new records
    let insertedCount = 0;
    for (const branchId of branches) {
      for (const d of dates) {
        for (const level of levels) {
          for (const meal of level.meals) {
            const id = crypto.randomUUID();
            await client.query(`
              INSERT INTO meal_items 
              (id, created_at, updated_at, branch_id, product_id, meal_period, status, level, day_of_week, date_key, sort_order)
              VALUES ($1, NOW(), NOW(), $2, $3, $4, 'ACTIVE', $5, $6, $7, 1)
            `, [id, branchId, productId, meal, level.name, d.dayOfWeek, d.dateKey]);
            insertedCount++;
          }
        }
      }
    }
    console.log(`Inserted ${insertedCount} mock meal items successfully.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

seed().catch(console.error);
