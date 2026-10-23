import { saleQuantitySql } from './sale-quantity';

jest.setTimeout(30000);

// Opt-in PostgreSQL checks. Fixtures live only in connection-local temporary
// tables and every test rolls back; application tables are never modified.
const postgres =
  process.env.SALE_QUANTITY_POSTGRES_TEST === '1' ? describe : describe.skip;
postgres('Recipe sale capacity on PostgreSQL', () => {
  let client: any;
  beforeAll(async () => {
    require('dotenv').config({ quiet: true });
    const { Client } = require('pg');
    client = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || process.env.DB_NAME,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });
  beforeEach(async () => {
    await client.query(`BEGIN;
      SET LOCAL search_path TO pg_temp;
      SET LOCAL statement_timeout = '5s';
      CREATE TEMP TABLE products (
        id text, requires_cooking boolean DEFAULT false, product_type text,
        base_unit_id text, lot_tracking_enabled boolean DEFAULT false
      ) ON COMMIT DROP;
      CREATE TEMP TABLE stocks (id text, branch_id text) ON COMMIT DROP;
      CREATE TEMP TABLE stock_items (stock_id text, product_id text, quantity numeric) ON COMMIT DROP;
      CREATE TEMP TABLE stock_lots (stock_id text, product_id text, quantity numeric, expires_at date) ON COMMIT DROP;
      CREATE TEMP TABLE measurement_units (id text, dimension text, factor_to_base numeric) ON COMMIT DROP;
      CREATE TEMP TABLE kitchen_recipes (
        id text, branch_id text, product_id text, status text,
        yield_quantity numeric, version int, effective_from timestamptz
      ) ON COMMIT DROP;
      CREATE TEMP TABLE kitchen_recipe_items (
        recipe_id text, ingredient_product_id text, quantity numeric, unit_id text
      ) ON COMMIT DROP;
      INSERT INTO products VALUES
        ('bread', true, 'FINISHED_GOOD', 'piece', false),
        ('meat', false, 'INGREDIENT', 'g', false),
        ('bun', false, 'INGREDIENT', 'piece', false),
        ('milk', false, 'MERCHANDISE', 'piece', false);
      INSERT INTO measurement_units VALUES
        ('g', 'MASS', 1), ('kg', 'MASS', 1000), ('piece', 'COUNT', 1);
      INSERT INTO stocks VALUES ('a', 'branch-a'), ('b', 'branch-b');
      INSERT INTO stock_items VALUES
        ('a', 'meat', 960), ('a', 'bun', 99), ('a', 'milk', 7),
        ('b', 'meat', 100000), ('b', 'bun', 100000);
      INSERT INTO kitchen_recipes VALUES
        ('recipe', 'branch-a', 'bread', 'ACTIVE', 1, 1, NULL);
      INSERT INTO kitchen_recipe_items VALUES
        ('recipe', 'meat', 40, 'g'), ('recipe', 'bun', 1, 'piece');
    `);
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  async function quantity(
    id = 'bread',
    branch: string | undefined = 'branch-a',
  ) {
    const sql = saleQuantitySql(branch).replaceAll(':branchId', '$2');
    const values = branch ? [id, branch] : [id];
    const { rows } = await client.query(
      `SELECT (${sql}) AS quantity FROM products product WHERE product.id=$1`,
      values,
    );
    return Number(rows[0].quantity);
  }

  it('takes the limiting input and ignores inventory in another branch', async () => {
    expect(await quantity()).toBe(24);
  });
  it('converts recipe kilograms into stock grams and floors whole servings', async () => {
    await client.query(
      "UPDATE kitchen_recipe_items SET quantity=0.05,unit_id='kg' WHERE ingredient_product_id='meat'",
    );
    expect(await quantity()).toBe(19);
  });
  it('accounts for a recipe yielding multiple portions', async () => {
    await client.query('UPDATE kitchen_recipes SET yield_quantity=2');
    expect(await quantity()).toBe(48);
  });
  it('returns zero when one required input is missing', async () => {
    await client.query(
      "DELETE FROM stock_items WHERE stock_id='a' AND product_id='bun'",
    );
    expect(await quantity()).toBe(0);
  });
  it('returns zero for missing or inactive recipes and empty recipes', async () => {
    await client.query("UPDATE kitchen_recipes SET status='DRAFT'");
    expect(await quantity()).toBe(0);
    await client.query(
      "UPDATE kitchen_recipes SET status='ACTIVE'; DELETE FROM kitchen_recipe_items",
    );
    expect(await quantity()).toBe(0);
  });
  it('fails closed for invalid unit dimensions or missing unit metadata', async () => {
    await client.query(
      "UPDATE kitchen_recipe_items SET unit_id='piece' WHERE ingredient_product_id='meat'",
    );
    expect(await quantity()).toBe(0);
    await client.query(
      "UPDATE kitchen_recipe_items SET unit_id='missing' WHERE ingredient_product_id='meat'",
    );
    expect(await quantity()).toBe(0);
  });
  it('excludes expired lots and caps tracked inputs by warehouse balance', async () => {
    await client.query(`UPDATE products SET lot_tracking_enabled=true WHERE id='meat';
      INSERT INTO stock_lots VALUES
        ('a', 'meat', 800, CURRENT_DATE-1), ('a', 'meat', 160, CURRENT_DATE+1)`);
    expect(await quantity()).toBe(4);
    await client.query(
      "UPDATE stock_items SET quantity=80 WHERE stock_id='a' AND product_id='meat'",
    );
    expect(await quantity()).toBe(2);
  });
  it('counts fuel when it is a required recipe input', async () => {
    await client.query(`INSERT INTO products VALUES ('gas',false,'FUEL','g',false);
      INSERT INTO stock_items VALUES ('a','gas',15);
      INSERT INTO kitchen_recipe_items VALUES ('recipe','gas',5,'g')`);
    expect(await quantity()).toBe(3);
  });
  it('chooses the latest effective active recipe', async () => {
    await client.query(`INSERT INTO kitchen_recipes VALUES
        ('new','branch-a','bread','ACTIVE',1,2,NULL),
        ('future','branch-a','bread','ACTIVE',1,3,CURRENT_TIMESTAMP+INTERVAL '1 day');
      INSERT INTO kitchen_recipe_items VALUES ('new','meat',80,'g'), ('future','meat',1,'g')`);
    expect(await quantity()).toBe(12);
  });
  it('keeps merchandise on actual warehouse stock and shared recipes at zero', async () => {
    expect(await quantity('milk')).toBe(7);
    expect(await quantity('bread', '')).toBe(0);
  });
});
