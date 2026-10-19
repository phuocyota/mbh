import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductMinimumStock1764800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products ADD COLUMN minimum_stock numeric(18,4),
      ADD CONSTRAINT "CHK_product_minimum_stock" CHECK(minimum_stock IS NULL OR minimum_stock>=0)`);
    await q.query(
      `CREATE INDEX "IDX_stock_movements_stock_created" ON stock_movements(stock_id,created_at)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_stock_movements_stock_created"`);
    await q.query(`ALTER TABLE products DROP COLUMN minimum_stock`);
  }
}
