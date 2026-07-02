import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProductUniqueKey1760000000000 implements MigrationInterface {
  name = 'UpdateProductUniqueKey1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN IF EXISTS "sku" CASCADE
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_products_id_branch_id'
            AND conrelid = '"products"'::regclass
        ) THEN
          ALTER TABLE "products"
          ADD CONSTRAINT "UQ_products_id_branch_id" UNIQUE ("id", "branch_id");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP CONSTRAINT IF EXISTS "UQ_products_id_branch_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "sku" character varying
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_sku_unique"
      ON "products" ("sku")
      WHERE "sku" IS NOT NULL
    `);
  }
}
