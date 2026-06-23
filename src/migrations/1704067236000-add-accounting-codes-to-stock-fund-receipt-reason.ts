import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingCodesToStockFundReceiptReason1704067236000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_fund_receipt_reason"
        ADD COLUMN IF NOT EXISTS "code" character varying,
        ADD COLUMN IF NOT EXISTS "debit_account_code" character varying,
        ADD COLUMN IF NOT EXISTS "credit_account_code" character varying,
        ADD COLUMN IF NOT EXISTS "tax_account_code" character varying
    `);

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
      VALUES (
        'BHHTN',
        'Bán hàng hóa trong nước',
        'Default accounting accounts for domestic sales vouchers',
        'active',
        '131',
        '5111',
        '33311'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" = 'BHHTN'
        AND "reason" = 'Bán hàng hóa trong nước'
        AND "debit_account_code" = '131'
        AND "credit_account_code" = '5111'
        AND "tax_account_code" = '33311'
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_fund_receipt_reason"
        DROP COLUMN IF EXISTS "tax_account_code",
        DROP COLUMN IF EXISTS "credit_account_code",
        DROP COLUMN IF EXISTS "debit_account_code",
        DROP COLUMN IF EXISTS "code"
    `);
  }
}
