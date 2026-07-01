import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerMealItems1704067249000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_meal_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "customer_id" uuid NOT NULL,
        "meal_item_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "note" text,
        CONSTRAINT "PK_customer_meal_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customer_meal_items_customer_meal_item" UNIQUE ("customer_id", "meal_item_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_customer_meal_items_customer'
        ) THEN
          ALTER TABLE "customer_meal_items"
            ADD CONSTRAINT "FK_customer_meal_items_customer"
            FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_customer_meal_items_meal_item'
        ) THEN
          ALTER TABLE "customer_meal_items"
            ADD CONSTRAINT "FK_customer_meal_items_meal_item"
            FOREIGN KEY ("meal_item_id") REFERENCES "meal_items"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_meal_items_customer_status"
      ON "customer_meal_items" ("customer_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_meal_items_meal_item"
      ON "customer_meal_items" ("meal_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_customer_meal_items_meal_item"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_customer_meal_items_customer_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_meal_items"`);
  }
}
