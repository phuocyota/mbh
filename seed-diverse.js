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
    // 1. Get a valid category_id
    const resCat = await client.query('SELECT id FROM categories LIMIT 1');
    if (resCat.rows.length === 0) {
      console.log('No category found, cannot insert products.');
      return;
    }
    const categoryId = resCat.rows[0].id;

    // 2. Insert new boarding products
    const mealsToCreate = [
      { name: 'Phở bò nghêu ngao', desc: 'Súp phở đậm đà với thịt bò mềm' },
      { name: 'Bún chả Hà Nội', desc: 'Bún chả truyền thống thơm ngon' },
      { name: 'Cơm sườn nướng', desc: 'Cơm tấm sườn nướng mật ong' },
      { name: 'Bánh mì ốp la', desc: 'Bánh mì trứng ốp la xúc xích' },
      { name: 'Súp cua gà xé', desc: 'Súp cua thanh đạm, dễ tiêu hóa' },
      { name: 'Mì Ý sốt bò băm', desc: 'Mì Spaghetti sốt bò băm cà chua' },
      { name: 'Cơm gà xối mỡ', desc: 'Gà xối mỡ giòn rụm với cơm' },
      { name: 'Bún bò Huế', desc: 'Bún bò Huế thơm lừng vị sả' },
      { name: 'Bún riêu cua', desc: 'Bún riêu cua đồng thanh mát' },
      { name: 'Cơm rang dưa bò', desc: 'Cơm rang giòn với dưa chua thịt bò' }
    ];

    const mealIds = [];
    for (const m of mealsToCreate) {
      const id = crypto.randomUUID();
      await client.query(`
        INSERT INTO products (id, category_id, name, description, price, is_active, is_canteen_item)
        VALUES ($1, $2, $3, $4, 0, true, false)
      `, [id, categoryId, m.name, m.desc]);
      mealIds.push(id);
    }

    // Include the original Cơm thịt kho trứng if exists
    const resOrig = await client.query('SELECT id FROM products WHERE is_canteen_item = false AND name = $1', ['Cơm thịt kho trứng']);
    if (resOrig.rows.length > 0) {
      mealIds.push(resOrig.rows[0].id);
    }

    console.log(`Created ${mealsToCreate.length} new boarding meals.`);

    // 3. Clear existing schedule
    const resBranches = await client.query("SELECT id FROM branches");
    const branches = resBranches.rows.map(r => r.id);

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
    
    const dateKeys = dates.map(d => d.dateKey);
    await client.query('DELETE FROM meal_items WHERE date_key = ANY($1)', [dateKeys]);
    console.log('Deleted existing meal items for this week.');

    // 4. Seed with random meals
    const levels = [
      { name: 'preschool', meals: ['BREAKFAST', 'LUNCH', 'AFTERNOON'] },
      { name: 'primary', meals: ['LUNCH', 'AFTERNOON'] }
    ];

    let insertedCount = 0;
    for (const branchId of branches) {
      for (const d of dates) {
        for (const level of levels) {
          for (const meal of level.meals) {
            const mealId = mealIds[Math.floor(Math.random() * mealIds.length)];
            const id = crypto.randomUUID();
            await client.query(`
              INSERT INTO meal_items 
              (id, created_at, updated_at, branch_id, product_id, meal_period, status, level, day_of_week, date_key, sort_order)
              VALUES ($1, NOW(), NOW(), $2, $3, $4, 'ACTIVE', $5, $6, $7, 1)
            `, [id, branchId, mealId, meal, level.name, d.dayOfWeek, d.dateKey]);
            insertedCount++;
          }
        }
      }
    }
    console.log(`Inserted ${insertedCount} random mock meal items successfully.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

seed().catch(console.error);
