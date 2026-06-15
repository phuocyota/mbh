import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingCodesToMoneyVouchers1704067222000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "money_vouchers" ADD COLUMN IF NOT EXISTS "debit_account_code" character varying`);
    await queryRunner.query(`ALTER TABLE "money_vouchers" ADD COLUMN IF NOT EXISTS "credit_account_code" character varying`);
    await queryRunner.query(`ALTER TABLE "fund_transactions" ADD COLUMN IF NOT EXISTS "debit_account_code" character varying`);
    await queryRunner.query(`ALTER TABLE "fund_transactions" ADD COLUMN IF NOT EXISTS "credit_account_code" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fund_transactions" DROP COLUMN IF EXISTS "credit_account_code"`);
    await queryRunner.query(`ALTER TABLE "fund_transactions" DROP COLUMN IF EXISTS "debit_account_code"`);
    await queryRunner.query(`ALTER TABLE "money_vouchers" DROP COLUMN IF EXISTS "credit_account_code"`);
    await queryRunner.query(`ALTER TABLE "money_vouchers" DROP COLUMN IF EXISTS "debit_account_code"`);
  }
}
