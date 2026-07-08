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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
