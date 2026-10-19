import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductBoardingFlag1764700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE products ADD COLUMN is_boarding boolean NOT NULL DEFAULT false`,
    );
    // Preserve the previous checkbox display for existing products.
    await q.query(`UPDATE products SET is_boarding = NOT is_canteen_item`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products DROP COLUMN is_boarding`);
  }
}
