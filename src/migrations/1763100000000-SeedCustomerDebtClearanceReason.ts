import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCustomerDebtClearanceReason1763100000000
  implements MigrationInterface
{
  name = 'SeedCustomerDebtClearanceReason1763100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Trả nợ',
          "accounting_formula" = '{111:-,131:-}',
          "note" = 'Default reason for customer debt clearance receipts.',
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
            'Trả nợ',
            '{111:-,131:-}',
            'Default reason for customer debt clearance receipts.',
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
      WHERE "code" = 'TNBHTS'
    `);
  }
}
