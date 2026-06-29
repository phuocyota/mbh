import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSupplierStockImportReason1704067241000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "stock_fund_receipt_reason" (
        "code",
        "reason",
        "note",
        "status",
        "debit_account_code",
        "credit_account_code",
        "tax_account_code"
      )
      SELECT
        'NHNCC',
        U&'Nh\\1EADp h\\00E0ng t\\1EEB nh\\00E0 cung c\\1EA5p',
        'Default accounting reason for supplier stock imports',
        'active',
        '1561',
        '331',
        '1331'
      WHERE NOT EXISTS (
        SELECT 1
        FROM "stock_fund_receipt_reason"
        WHERE "code" = 'NHNCC'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" = 'NHNCC'
        AND "reason" = U&'Nh\\1EADp h\\00E0ng t\\1EEB nh\\00E0 cung c\\1EA5p'
        AND "debit_account_code" = '1561'
        AND "credit_account_code" = '331'
        AND "tax_account_code" = '1331'
    `);
  }
}
