import { MigrationInterface, QueryRunner } from 'typeorm';

export class KitchenPortalAndStockLots1764000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products
      ADD COLUMN IF NOT EXISTS product_type varchar,
      ADD COLUMN IF NOT EXISTS lot_tracking_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS requires_sample boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS cook_duration integer NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS recommended_use_minutes integer NOT NULL DEFAULT 120`);
    await q.query(
      `ALTER TABLE stock_items ALTER COLUMN quantity TYPE numeric(18,4)`,
    );
    await q.query(
      `ALTER TABLE stock_receipt_detail ALTER COLUMN quantity TYPE numeric(18,4), ADD COLUMN IF NOT EXISTS input_details jsonb`,
    );
    await q.query(`ALTER TABLE kitchen_production_batches
      ALTER COLUMN meal_item_id DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS source varchar NOT NULL DEFAULT 'BOARDING',
      ADD COLUMN IF NOT EXISTS manual_line_id uuid,
      ADD COLUMN IF NOT EXISTS actual_quantity numeric(18,4),
      ADD COLUMN IF NOT EXISTS shift varchar NOT NULL DEFAULT 'Ca trưa',
      ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS kitchen_batch_manual_line_unique ON kitchen_production_batches(manual_line_id)`,
    );
    const base = `id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by varchar,updated_by varchar`;
    await q.query(
      `CREATE TABLE IF NOT EXISTS stock_lots (${base},stock_id uuid NOT NULL REFERENCES stocks(id),product_id uuid NOT NULL REFERENCES products(id),lot_code varchar NOT NULL,manufactured_at date,expires_at date,quantity numeric(18,4) NOT NULL DEFAULT 0,UNIQUE(stock_id,product_id,lot_code))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS stock_movements (${base},stock_id uuid NOT NULL REFERENCES stocks(id),product_id uuid NOT NULL REFERENCES products(id),lot_id uuid REFERENCES stock_lots(id),reference_id uuid NOT NULL,quantity numeric(18,4) NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS stock_requests (${base},branch_id uuid NOT NULL REFERENCES branches(id),request_id uuid NOT NULL,result jsonb NOT NULL,payload_hash varchar NOT NULL,UNIQUE(branch_id,request_id))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS kitchen_operations (${base},branch_id uuid NOT NULL REFERENCES branches(id),kind varchar NOT NULL,date date NOT NULL,shift varchar NOT NULL,status varchar NOT NULL DEFAULT 'DRAFT',parent_id uuid,request_id uuid,payload jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,UNIQUE(branch_id,request_id))`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS kitchen_operations_scope ON kitchen_operations(branch_id,kind,date,shift)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS stock_lots_scope ON stock_lots(stock_id,product_id)`,
    );
    await q.query(
      `ALTER TABLE stock_take_items ADD COLUMN IF NOT EXISTS lot_counts jsonb`,
    );
    await q.query(
      `ALTER TABLE stock_take_items ALTER COLUMN system_quantity TYPE numeric(18,4), ALTER COLUMN actual_quantity TYPE numeric(18,4), ALTER COLUMN difference_quantity TYPE numeric(18,4)`,
    );
    await q.query(
      `ALTER TABLE stock_takes ALTER COLUMN increase_quantity TYPE numeric(18,4), ALTER COLUMN decrease_quantity TYPE numeric(18,4)`,
    );
  }
  async down(): Promise<void> {
    // An automatic down would destroy reviewed opening allocations and kitchen audit data.
    throw new Error(
      'Restore a reviewed backup to roll back KitchenPortalAndStockLots',
    );
  }
}
