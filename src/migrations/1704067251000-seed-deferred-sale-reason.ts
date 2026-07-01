import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDeferredSaleReason1704067251000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_fund_receipt_reason"
        ADD COLUMN IF NOT EXISTS "accounting_formula" text
    `);

    await queryRunner.query(`
      INSERT INTO "stock_fund_receipt_reason" (
        "code",
        "reason",
        "note",
        "fund_id",
        "status",
        "debit_account_code",
        "credit_account_code",
        "tax_account_code",
        "accounting_formula"
      )
      SELECT
        'BH_TRA_CHAM',
        U&'B\\00E1n h\\00E0ng tr\\1EA3 ch\\1EADm',
        'Default reason for deferred sales and customer advance offsets',
        NULL,
        'active',
        '131',
        '5111',
        '33311',
        '{131:-,5111:+,33311:+,3387:+}'
      WHERE NOT EXISTS (
        SELECT 1
        FROM "stock_fund_receipt_reason"
        WHERE "code" = 'BH_TRA_CHAM'
      )
    `);

    await queryRunner.query(`
      UPDATE "stock_fund_receipt_reason"
      SET
        "reason" = U&'B\\00E1n h\\00E0ng tr\\1EA3 ch\\1EADm',
        "note" = 'Default reason for deferred sales and customer advance offsets',
        "fund_id" = NULL,
        "debit_account_code" = '131',
        "credit_account_code" = '5111',
        "tax_account_code" = '33311',
        "accounting_formula" = '{131:-,5111:+,33311:+,3387:+}',
        "status" = 'active',
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "code" = 'BH_TRA_CHAM'
    `);

    await queryRunner.query(`
      UPDATE "stock_fund_receipt_reason"
      SET "accounting_formula" = CONCAT(
        '{',
        "debit_account_code",
        ':-,',
        "credit_account_code",
        ':+',
        CASE
          WHEN "tax_account_code" IS NOT NULL AND "tax_account_code" <> ''
            THEN CONCAT(',', "tax_account_code", ':+')
          ELSE ''
        END,
        '}'
      )
      WHERE "accounting_formula" IS NULL
        AND "debit_account_code" IS NOT NULL
        AND "credit_account_code" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_fund_receipt_reason"
        DROP COLUMN IF EXISTS "tax_account_code",
        DROP COLUMN IF EXISTS "credit_account_code",
        DROP COLUMN IF EXISTS "debit_account_code"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_fund_receipt_reason"
        ADD COLUMN IF NOT EXISTS "debit_account_code" character varying,
        ADD COLUMN IF NOT EXISTS "credit_account_code" character varying,
        ADD COLUMN IF NOT EXISTS "tax_account_code" character varying
    `);

    await queryRunner.query(`
      UPDATE "stock_fund_receipt_reason"
      SET
        "debit_account_code" = '131',
        "credit_account_code" = '5111',
        "tax_account_code" = '33311'
      WHERE "code" = 'BH_TRA_CHAM'
    `);

    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" = 'BH_TRA_CHAM'
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_fund_receipt_reason"
        DROP COLUMN IF EXISTS "accounting_formula"
    `);
  }
}
