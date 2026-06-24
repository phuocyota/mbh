import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxCustomerDebtToBranches1704067238000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
        ADD COLUMN IF NOT EXISTS "max_customer_debt" numeric(15,2) NOT NULL DEFAULT 50000
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
        DROP COLUMN IF EXISTS "max_customer_debt"
    `);
  }
}
