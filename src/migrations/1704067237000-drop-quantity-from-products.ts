import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropQuantityFromProducts1704067237000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "quantity"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "quantity" numeric(12,2) NOT NULL DEFAULT 0
    `);
  }
}
