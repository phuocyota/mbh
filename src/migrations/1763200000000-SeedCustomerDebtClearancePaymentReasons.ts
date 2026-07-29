import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCustomerDebtClearancePaymentReasons1763200000000 implements MigrationInterface {
  name = 'SeedCustomerDebtClearancePaymentReasons1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Thu nợ khách hàng bằng tiền mặt',
          "accounting_formula" = '{111:-,131:+}',
          "note" = 'Cash customer debt clearance. Fund account is resolved from account 111 in this formula.',
          "is_debt" = false,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'TNBHTS';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id",
            "created_at",
            "updated_at",
            "code",
            "reason",
            "accounting_formula",
            "note",
            "is_debt",
            "status"
          )
          VALUES (
            uuid_generate_v4(),
            now(),
            now(),
            'TNBHTS',
            'Thu nợ khách hàng bằng tiền mặt',
            '{111:-,131:+}',
            'Cash customer debt clearance. Fund account is resolved from account 111 in this formula.',
            false,
            'active'
          );
        END IF;

        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Thu nợ khách hàng bằng tiền gửi',
          "accounting_formula" = '{112:-,131:+}',
          "note" = 'Bank customer debt clearance. Fund account is resolved from account 112 in this formula.',
          "is_debt" = false,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'TNBHTS_BANK';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id",
            "created_at",
            "updated_at",
            "code",
            "reason",
            "accounting_formula",
            "note",
            "is_debt",
            "status"
          )
          VALUES (
            uuid_generate_v4(),
            now(),
            now(),
            'TNBHTS_BANK',
            'Thu nợ khách hàng bằng tiền gửi',
            '{112:-,131:+}',
            'Bank customer debt clearance. Fund account is resolved from account 112 in this formula.',
            false,
            'active'
          );
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" = 'TNBHTS_BANK';

      UPDATE "stock_fund_receipt_reason"
      SET
        "accounting_formula" = '{111:-,131:-}',
        "note" = 'Default reason for customer debt clearance receipts.',
        "updated_at" = now()
      WHERE "code" = 'TNBHTS'
    `);
  }
}
