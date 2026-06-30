import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedStockMoneyReceiptReasons1704067242000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH default_funds AS (
        SELECT
          (SELECT id FROM "funds" WHERE "code" = 'TM' ORDER BY "created_at" LIMIT 1) AS cash_fund_id,
          (SELECT "account_code" FROM "funds" WHERE "code" = 'TM' ORDER BY "created_at" LIMIT 1) AS cash_account_code,
          (SELECT id FROM "funds" WHERE "code" = 'NH' ORDER BY "created_at" LIMIT 1) AS bank_fund_id,
          (SELECT "account_code" FROM "funds" WHERE "code" = 'NH' ORDER BY "created_at" LIMIT 1) AS bank_account_code
      ),
      reason_values AS (
        SELECT
          v.code,
          v.reason,
          v.note,
          v.fund_id,
          v.debit_account_code,
          v.credit_account_code,
          v.tax_account_code
        FROM default_funds f
        CROSS JOIN LATERAL (
          VALUES
            (
              'BH_CASH',
              U&'B\\00E1n h\\00E0ng thu ti\\1EC1n m\\1EB7t',
              'Default reason for cash sales receipts',
              f.cash_fund_id,
              COALESCE(f.cash_account_code, '1111'),
              '5111',
              '33311'
            ),
            (
              'BH_BANK',
              U&'B\\00E1n h\\00E0ng thu chuy\\1EC3n kho\\1EA3n',
              'Default reason for bank, QR and MoMo sales receipts',
              f.bank_fund_id,
              COALESCE(f.bank_account_code, '1121'),
              '5111',
              '33311'
            ),
            (
              'BH_WALLET',
              U&'B\\00E1n h\\00E0ng thu qua v\\00ED',
              'Default reason for wallet sales receipts',
              COALESCE(f.bank_fund_id, f.cash_fund_id),
              COALESCE(f.bank_account_code, f.cash_account_code, '1121'),
              '5111',
              '33311'
            ),
            (
              'BH_CARD',
              U&'B\\00E1n h\\00E0ng thu qua th\\1EBB',
              'Default reason for card sales receipts',
              COALESCE(f.bank_fund_id, f.cash_fund_id),
              COALESCE(f.bank_account_code, f.cash_account_code, '1121'),
              '5111',
              '33311'
            ),
            (
              'NHNCC',
              U&'Nh\\1EADp h\\00E0ng t\\1EEB nh\\00E0 cung c\\1EA5p',
              'Default reason for supplier stock imports paid immediately',
              f.cash_fund_id,
              '1561',
              COALESCE(f.cash_account_code, '1111'),
              '1331'
            )
        ) AS v(
          code,
          reason,
          note,
          fund_id,
          debit_account_code,
          credit_account_code,
          tax_account_code
        )
      )
      UPDATE "stock_fund_receipt_reason" r
      SET
        "fund_id" = rv.fund_id,
        "reason" = rv.reason,
        "note" = rv.note,
        "debit_account_code" = rv.debit_account_code,
        "credit_account_code" = rv.credit_account_code,
        "tax_account_code" = rv.tax_account_code,
        "status" = 'active',
        "updated_at" = CURRENT_TIMESTAMP
      FROM reason_values rv
      WHERE r."code" = rv.code
    `);

    await queryRunner.query(`
      WITH default_funds AS (
        SELECT
          (SELECT id FROM "funds" WHERE "code" = 'TM' ORDER BY "created_at" LIMIT 1) AS cash_fund_id,
          (SELECT "account_code" FROM "funds" WHERE "code" = 'TM' ORDER BY "created_at" LIMIT 1) AS cash_account_code,
          (SELECT id FROM "funds" WHERE "code" = 'NH' ORDER BY "created_at" LIMIT 1) AS bank_fund_id,
          (SELECT "account_code" FROM "funds" WHERE "code" = 'NH' ORDER BY "created_at" LIMIT 1) AS bank_account_code
      ),
      reason_values AS (
        SELECT
          v.code,
          v.reason,
          v.note,
          v.fund_id,
          v.debit_account_code,
          v.credit_account_code,
          v.tax_account_code
        FROM default_funds f
        CROSS JOIN LATERAL (
          VALUES
            ('BH_CASH', U&'B\\00E1n h\\00E0ng thu ti\\1EC1n m\\1EB7t', 'Default reason for cash sales receipts', f.cash_fund_id, COALESCE(f.cash_account_code, '1111'), '5111', '33311'),
            ('BH_BANK', U&'B\\00E1n h\\00E0ng thu chuy\\1EC3n kho\\1EA3n', 'Default reason for bank, QR and MoMo sales receipts', f.bank_fund_id, COALESCE(f.bank_account_code, '1121'), '5111', '33311'),
            ('BH_WALLET', U&'B\\00E1n h\\00E0ng thu qua v\\00ED', 'Default reason for wallet sales receipts', COALESCE(f.bank_fund_id, f.cash_fund_id), COALESCE(f.bank_account_code, f.cash_account_code, '1121'), '5111', '33311'),
            ('BH_CARD', U&'B\\00E1n h\\00E0ng thu qua th\\1EBB', 'Default reason for card sales receipts', COALESCE(f.bank_fund_id, f.cash_fund_id), COALESCE(f.bank_account_code, f.cash_account_code, '1121'), '5111', '33311'),
            ('NHNCC', U&'Nh\\1EADp h\\00E0ng t\\1EEB nh\\00E0 cung c\\1EA5p', 'Default reason for supplier stock imports paid immediately', f.cash_fund_id, '1561', COALESCE(f.cash_account_code, '1111'), '1331')
        ) AS v(code, reason, note, fund_id, debit_account_code, credit_account_code, tax_account_code)
      )
      INSERT INTO "stock_fund_receipt_reason" (
        "code",
        "reason",
        "note",
        "fund_id",
        "status",
        "debit_account_code",
        "credit_account_code",
        "tax_account_code"
      )
      SELECT
        rv.code,
        rv.reason,
        rv.note,
        rv.fund_id,
        'active',
        rv.debit_account_code,
        rv.credit_account_code,
        rv.tax_account_code
      FROM reason_values rv
      WHERE NOT EXISTS (
        SELECT 1
        FROM "stock_fund_receipt_reason" existing
        WHERE existing."code" = rv.code
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" IN ('BH_CASH', 'BH_BANK', 'BH_WALLET', 'BH_CARD')
    `);
  }
}
