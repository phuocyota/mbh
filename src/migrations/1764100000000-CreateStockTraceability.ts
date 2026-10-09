import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockTraceability1764100000000
  implements MigrationInterface
{
  name = 'CreateStockTraceability1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create product_recipes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_recipes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branch_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "version" int NOT NULL,
        "yield_quantity" numeric(14,4) NOT NULL,
        "yield_unit_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "effective_from" timestamptz NULL,
        "description" text NULL,
        "standard_cost" numeric(15,2) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        CONSTRAINT "UQ_product_recipe_version" UNIQUE ("branch_id","product_id","version")
      )
    `);

    // 2. Create product_recipe_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_recipe_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "recipe_id" uuid NOT NULL,
        "ingredient_product_id" uuid NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unit_id" uuid NOT NULL,
        "required_lot_id" uuid NULL,
        "waste_factor" numeric(5,2) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        CONSTRAINT "UQ_product_recipe_ingredient" UNIQUE ("recipe_id","ingredient_product_id")
      )
    `);

    // 3. Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_recipes_branch" ON "product_recipes" ("branch_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_recipes_product" ON "product_recipes" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_recipe_items_ingredient" ON "product_recipe_items" ("ingredient_product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_recipe_items_recipe" ON "product_recipe_items" ("recipe_id")
    `);

    // 4. Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "product_recipes" ADD CONSTRAINT "FK_product_recipe_product"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "product_recipes" ADD CONSTRAINT "FK_product_recipe_unit"
        FOREIGN KEY ("yield_unit_id") REFERENCES "measurement_units"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "product_recipe_items" ADD CONSTRAINT "FK_pri_recipe"
        FOREIGN KEY ("recipe_id") REFERENCES "product_recipes"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "product_recipe_items" ADD CONSTRAINT "FK_pri_ingredient"
        FOREIGN KEY ("ingredient_product_id") REFERENCES "products"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "product_recipe_items" ADD CONSTRAINT "FK_pri_unit"
        FOREIGN KEY ("unit_id") REFERENCES "measurement_units"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_recipe_items" DROP CONSTRAINT IF EXISTS "FK_pri_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_recipe_items" DROP CONSTRAINT IF EXISTS "FK_pri_ingredient"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_recipe_items" DROP CONSTRAINT IF EXISTS "FK_pri_recipe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_recipes" DROP CONSTRAINT IF EXISTS "FK_product_recipe_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_recipes" DROP CONSTRAINT IF EXISTS "FK_product_recipe_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_recipe_items_recipe"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_recipe_items_ingredient"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_recipes_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_recipes_branch"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_recipe_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_recipes" CASCADE`);
  }
}
