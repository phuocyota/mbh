import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductRequiresCooking1764900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE products ADD COLUMN requires_cooking boolean NOT NULL DEFAULT false',
    );
    await q.query(
      "UPDATE products SET requires_cooking = true WHERE product_type = 'FINISHED_GOOD'",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE products DROP COLUMN requires_cooking');
  }
}
