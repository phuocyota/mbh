import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMoneyVoucherCustomerId1762500000000
  implements MigrationInterface
{
  name = 'AddMoneyVoucherCustomerId1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      ADD COLUMN IF NOT EXISTS "customer_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_money_vouchers_customer_id'
            AND conrelid = '"money_vouchers"'::regclass
        ) THEN
          ALTER TABLE "money_vouchers"
          ADD CONSTRAINT "FK_money_vouchers_customer_id"
          FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_money_vouchers_customer_id"
      ON "money_vouchers" ("customer_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_money_vouchers_customer_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      DROP CONSTRAINT IF EXISTS "FK_money_vouchers_customer_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "money_vouchers"
      DROP COLUMN IF EXISTS "customer_id"
    `);
  }
}
