import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropMoneyVoucherAccountCodes1763000000000
  implements MigrationInterface
{
  name = 'DropMoneyVoucherAccountCodes1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      DROP COLUMN IF EXISTS "debit_account_code",
      DROP COLUMN IF EXISTS "credit_account_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "fund_transactions"
      DROP COLUMN IF EXISTS "debit_account_code",
      DROP COLUMN IF EXISTS "credit_account_code"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fund_transactions"
      ADD COLUMN IF NOT EXISTS "debit_account_code" varchar,
      ADD COLUMN IF NOT EXISTS "credit_account_code" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      ADD COLUMN IF NOT EXISTS "debit_account_code" varchar,
      ADD COLUMN IF NOT EXISTS "credit_account_code" varchar
    `);
  }
}
