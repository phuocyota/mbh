import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMealItems1704067243000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meal_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "branch_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "meal_period" character varying NOT NULL,
        "level" character varying NOT NULL DEFAULT 'primary',
        "day_of_week" integer,
        "date_key" character varying,
        "sort_order" integer NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "note" text,
        CONSTRAINT "PK_meal_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_meal_items_branch_product_period_date_level" UNIQUE ("branch_id", "product_id", "meal_period", "date_key", "level")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_meal_items_branch'
        ) THEN
          ALTER TABLE "meal_items"
            ADD CONSTRAINT "FK_meal_items_branch"
            FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_meal_items_product'
        ) THEN
          ALTER TABLE "meal_items"
            ADD CONSTRAINT "FK_meal_items_product"
            FOREIGN KEY ("product_id") REFERENCES "products"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meal_items_period_status"
      ON "meal_items" ("branch_id", "meal_period", "date_key", "level", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_meal_items_period_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "meal_items"`);
  }
}
