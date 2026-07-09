import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFundCodeBranchUnique1762900000000
  implements MigrationInterface
{
  name = 'UpdateFundCodeBranchUnique1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "funds"
      DROP CONSTRAINT IF EXISTS "UQ_funds_code"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_funds_code_branch_id'
        ) THEN
          ALTER TABLE "funds"
          ADD CONSTRAINT "UQ_funds_code_branch_id" UNIQUE ("code", "branch_id");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "funds"
      DROP CONSTRAINT IF EXISTS "UQ_funds_code_branch_id"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_funds_code'
        ) THEN
          ALTER TABLE "funds"
          ADD CONSTRAINT "UQ_funds_code" UNIQUE ("code");
        END IF;
      END
      $$;
    `);
  }
}
