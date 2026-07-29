import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceAccountingFormulaFundReasons1763300000000 implements MigrationInterface {
  name = 'EnforceAccountingFormulaFundReasons1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      ADD COLUMN IF NOT EXISTS "reason_code" varchar
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_money_vouchers_reason_code"
      ON "money_vouchers" ("reason_code")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Thu khác bằng tiền mặt',
          "accounting_formula" = '{111:-,711:+}',
          "note" = 'Quỹ thu được quyết định bởi tài khoản 111 trong công thức.',
          "is_debt" = false,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'THU_KHAC_CASH';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id", "created_at", "updated_at", "code", "reason",
            "accounting_formula", "note", "is_debt", "status"
          )
          VALUES (
            uuid_generate_v4(), now(), now(), 'THU_KHAC_CASH',
            'Thu khác bằng tiền mặt', '{111:-,711:+}',
            'Quỹ thu được quyết định bởi tài khoản 111 trong công thức.',
            false, 'active'
          );
        END IF;

        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Chi khác bằng tiền mặt',
          "accounting_formula" = '{811:-,111:+}',
          "note" = 'Quỹ chi được quyết định bởi tài khoản 111 trong công thức.',
          "is_debt" = false,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'CHI_KHAC_CASH';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id", "created_at", "updated_at", "code", "reason",
            "accounting_formula", "note", "is_debt", "status"
          )
          VALUES (
            uuid_generate_v4(), now(), now(), 'CHI_KHAC_CASH',
            'Chi khác bằng tiền mặt', '{811:-,111:+}',
            'Quỹ chi được quyết định bởi tài khoản 111 trong công thức.',
            false, 'active'
          );
        END IF;

        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Chi khác bằng tiền gửi',
          "accounting_formula" = '{811:-,112:+}',
          "note" = 'Quỹ chi được quyết định bởi tài khoản 112 trong công thức.',
          "is_debt" = false,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'CHI_KHAC_BANK';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id", "created_at", "updated_at", "code", "reason",
            "accounting_formula", "note", "is_debt", "status"
          )
          VALUES (
            uuid_generate_v4(), now(), now(), 'CHI_KHAC_BANK',
            'Chi khác bằng tiền gửi', '{811:-,112:+}',
            'Quỹ chi được quyết định bởi tài khoản 112 trong công thức.',
            false, 'active'
          );
        END IF;

        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Thu khác bằng tiền gửi',
          "accounting_formula" = '{112:-,711:+}',
          "note" = 'Quỹ thu được quyết định bởi tài khoản 112 trong công thức.',
          "is_debt" = false,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'THU_KHAC_BANK';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id", "created_at", "updated_at", "code", "reason",
            "accounting_formula", "note", "is_debt", "status"
          )
          VALUES (
            uuid_generate_v4(), now(), now(), 'THU_KHAC_BANK',
            'Thu khác bằng tiền gửi', '{112:-,711:+}',
            'Quỹ thu được quyết định bởi tài khoản 112 trong công thức.',
            false, 'active'
          );
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" IN (
        'THU_KHAC_CASH',
        'THU_KHAC_BANK',
        'CHI_KHAC_CASH',
        'CHI_KHAC_BANK'
      )
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_money_vouchers_reason_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      DROP COLUMN IF EXISTS "reason_code"
    `);
  }
}
