import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleFieldsToMealItems1704067247000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meal_items"
      ADD COLUMN IF NOT EXISTS "level" character varying NOT NULL DEFAULT 'primary',
      ADD COLUMN IF NOT EXISTS "day_of_week" integer,
      ADD COLUMN IF NOT EXISTS "date_key" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "meal_items"
      DROP CONSTRAINT IF EXISTS "UQ_meal_items_branch_product_period"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_meal_items_branch_product_period_date_level'
        ) THEN
          ALTER TABLE "meal_items"
            ADD CONSTRAINT "UQ_meal_items_branch_product_period_date_level"
            UNIQUE ("branch_id", "product_id", "meal_period", "date_key", "level");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_meal_items_period_status"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meal_items_period_status"
      ON "meal_items" ("branch_id", "meal_period", "date_key", "level", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_meal_items_period_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "meal_items"
      DROP CONSTRAINT IF EXISTS "UQ_meal_items_branch_product_period_date_level"
    `);

    await queryRunner.query(`
      ALTER TABLE "meal_items"
      ADD CONSTRAINT "UQ_meal_items_branch_product_period"
      UNIQUE ("branch_id", "product_id", "meal_period")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meal_items_period_status"
      ON "meal_items" ("branch_id", "meal_period", "status")
    `);

    await queryRunner.query(`
      ALTER TABLE "meal_items"
      DROP COLUMN IF EXISTS "date_key",
      DROP COLUMN IF EXISTS "day_of_week",
      DROP COLUMN IF EXISTS "level"
    `);
  }
}
