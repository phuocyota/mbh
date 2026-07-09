import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockReceiptImportSource1762600000000
  implements MigrationInterface
{
  name = 'AddStockReceiptImportSource1762600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      ADD COLUMN IF NOT EXISTS "from_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      ADD COLUMN IF NOT EXISTS "from_type" varchar
    `);

    await queryRunner.query(`
      UPDATE "stock_receipt_import"
      SET
        "from_id" = COALESCE("from_id", "to_id"),
        "from_type" = COALESCE("from_type", UPPER("to_type"))
      WHERE "to_id" IS NOT NULL
        AND COALESCE(UPPER("to_type"), '') NOT IN ('BRANCH', 'STOCK')
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      DROP COLUMN IF EXISTS "to_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      DROP COLUMN IF EXISTS "to_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      ADD COLUMN IF NOT EXISTS "to_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      ADD COLUMN IF NOT EXISTS "to_type" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      DROP COLUMN IF EXISTS "from_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_receipt_import"
      DROP COLUMN IF EXISTS "from_id"
    `);
  }
}
