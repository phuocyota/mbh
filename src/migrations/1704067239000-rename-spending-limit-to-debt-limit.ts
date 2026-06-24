import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameSpendingLimitToDebtLimit1704067239000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'spending_limit'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'debt_limit'
        ) THEN
          ALTER TABLE "customers" RENAME COLUMN "spending_limit" TO "debt_limit";
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'spending_limit'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'debt_limit'
        ) THEN
          UPDATE "customers" SET "debt_limit" = "spending_limit";
          ALTER TABLE "customers" DROP COLUMN "spending_limit";
        ELSIF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'debt_limit'
        ) THEN
          ALTER TABLE "customers"
            ADD COLUMN "debt_limit" numeric(12,2) NOT NULL DEFAULT 50000;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'debt_limit'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'customers'
            AND column_name = 'spending_limit'
        ) THEN
          ALTER TABLE "customers" RENAME COLUMN "debt_limit" TO "spending_limit";
        END IF;
      END $$;
    `);
  }
}
