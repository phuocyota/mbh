import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierBranchId1762100000000 implements MigrationInterface {
  name = 'AddSupplierBranchId1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers"
      ADD COLUMN IF NOT EXISTS "branch_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "suppliers"
      SET "branch_id" = '11111111-1111-4111-8111-111111111111'
      WHERE "branch_id" IS NULL
        AND EXISTS (
          SELECT 1
          FROM "branches"
          WHERE "id" = '11111111-1111-4111-8111-111111111111'
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_suppliers_branch_id'
            AND conrelid = '"suppliers"'::regclass
        ) THEN
          ALTER TABLE "suppliers"
          ADD CONSTRAINT "FK_suppliers_branch_id"
          FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers"
      DROP CONSTRAINT IF EXISTS "FK_suppliers_branch_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "suppliers"
      DROP COLUMN IF EXISTS "branch_id"
    `);
  }
}
