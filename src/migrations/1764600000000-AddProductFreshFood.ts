import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductFreshFood1764600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE products ADD COLUMN is_fresh_food boolean NOT NULL DEFAULT false`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products DROP COLUMN is_fresh_food`);
  }
}
