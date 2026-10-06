import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKitchenManagement1763600000000 implements MigrationInterface {
  name = 'CreateKitchenManagement1763600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "measurement_units" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "code" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL, "dimension" varchar NOT NULL,
        "factor_to_base" numeric(18,6) NOT NULL, "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO "measurement_units" ("code", "name", "dimension", "factor_to_base") VALUES
        ('g','Gram','MASS',1), ('kg','Kilogram','MASS',1000),
        ('ml','Milliliter','VOLUME',1), ('l','Liter','VOLUME',1000),
        ('piece','Piece','COUNT',1)
      ON CONFLICT ("code") DO NOTHING
    `);
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "base_unit_id" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "user_id" uuid NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_employees_user_id" ON "employees" ("user_id") WHERE "user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "products" p SET "base_unit_id" = u.id FROM "measurement_units" u WHERE p."base_unit_id" IS NULL AND lower(trim(p."unit")) = u."code"`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_stations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "code" varchar NOT NULL, "name" varchar NOT NULL, "description" text NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_station_branch_code" UNIQUE ("branch_id","code")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_product_stations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "product_id" uuid NOT NULL, "station_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_product_station_branch_product" UNIQUE ("branch_id","product_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_recipes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "product_id" uuid NOT NULL, "version" int NOT NULL,
        "yield_quantity" numeric(12,3) NOT NULL, "yield_unit_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT', "effective_from" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_recipe_version" UNIQUE ("branch_id","product_id","version")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_recipe_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "recipe_id" uuid NOT NULL,
        "ingredient_product_id" uuid NOT NULL, "quantity" numeric(14,4) NOT NULL, "unit_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_recipe_ingredient" UNIQUE ("recipe_id","ingredient_product_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_service_periods" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "meal_period" varchar NOT NULL, "start_time" time NOT NULL, "end_time" time NOT NULL,
        "cutoff_time" time NOT NULL, "timezone" varchar NOT NULL DEFAULT 'Asia/Bangkok',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_period_branch_meal" UNIQUE ("branch_id","meal_period")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_order_tickets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL UNIQUE,
        "branch_id" uuid NOT NULL, "station_id" uuid NULL, "status" varchar NOT NULL DEFAULT 'WAITING',
        "version" int NOT NULL DEFAULT 1, "started_at" timestamptz NULL, "ready_at" timestamptz NULL,
        "delivered_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kitchen_tickets_branch_status_created" ON "kitchen_order_tickets" ("branch_id","status","created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_order_ticket_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "ticket_id" uuid NOT NULL,
        "product_id" uuid NOT NULL, "product_name" varchar NOT NULL, "quantity" int NOT NULL, "note" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_meal_plans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "plan_date" date NOT NULL, "meal_period" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'DRAFT',
        "locked_at" timestamptz NULL, "locked_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_meal_plan_slot" UNIQUE ("branch_id","plan_date","meal_period")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_production_batches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "meal_plan_id" uuid NOT NULL,
        "meal_item_id" uuid NOT NULL, "product_id" uuid NOT NULL, "station_id" uuid NULL,
        "planned_quantity" int NOT NULL, "adjustment_quantity" int NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'WAITING', "version" int NOT NULL DEFAULT 1,
        "started_at" timestamptz NULL, "ready_at" timestamptz NULL, "completed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_batch_meal_item" UNIQUE ("meal_plan_id","meal_item_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_batch_adjustments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "batch_id" uuid NOT NULL,
        "quantity" int NOT NULL, "reason" text NOT NULL, "changed_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_consumption_sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "session_date" date NOT NULL, "meal_period" varchar NOT NULL, "station_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT', "stock_export_id" uuid NULL, "confirmed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_consumption_scope" UNIQUE ("branch_id","session_date","meal_period","station_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_consumption_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL,
        "product_id" uuid NOT NULL, "expected_quantity" numeric(14,4) NOT NULL,
        "actual_quantity" numeric(14,4) NOT NULL, "unit_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL,
        CONSTRAINT "UQ_kitchen_consumption_product" UNIQUE ("session_id","product_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_assignments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL, "station_id" uuid NOT NULL, "batch_id" uuid NULL,
        "work_date" date NOT NULL, "shift" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_stock_shortages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL, "product_id" uuid NOT NULL,
        "required_quantity" numeric(14,4) NOT NULL, "available_quantity" numeric(14,4) NOT NULL,
        "shortage_quantity" numeric(14,4) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar NULL, "updated_by" varchar NULL
      )
    `);

    const foreignKeys = [
      ['employees', 'user_id', 'users', 'id', 'FK_employees_user'],
      [
        'products',
        'base_unit_id',
        'measurement_units',
        'id',
        'FK_products_base_unit',
      ],
      [
        'kitchen_stations',
        'branch_id',
        'branches',
        'id',
        'FK_kitchen_station_branch',
      ],
      [
        'kitchen_product_stations',
        'branch_id',
        'branches',
        'id',
        'FK_kps_branch',
      ],
      [
        'kitchen_product_stations',
        'product_id',
        'products',
        'id',
        'FK_kps_product',
      ],
      [
        'kitchen_product_stations',
        'station_id',
        'kitchen_stations',
        'id',
        'FK_kps_station',
      ],
      [
        'kitchen_recipes',
        'branch_id',
        'branches',
        'id',
        'FK_kitchen_recipe_branch',
      ],
      [
        'kitchen_recipes',
        'product_id',
        'products',
        'id',
        'FK_kitchen_recipe_product',
      ],
      [
        'kitchen_recipes',
        'yield_unit_id',
        'measurement_units',
        'id',
        'FK_kitchen_recipe_unit',
      ],
      [
        'kitchen_recipe_items',
        'recipe_id',
        'kitchen_recipes',
        'id',
        'FK_kri_recipe',
      ],
      [
        'kitchen_recipe_items',
        'ingredient_product_id',
        'products',
        'id',
        'FK_kri_product',
      ],
      [
        'kitchen_recipe_items',
        'unit_id',
        'measurement_units',
        'id',
        'FK_kri_unit',
      ],
      [
        'kitchen_service_periods',
        'branch_id',
        'branches',
        'id',
        'FK_ksp_branch',
      ],
      ['kitchen_order_tickets', 'order_id', 'orders', 'id', 'FK_kot_order'],
      ['kitchen_order_tickets', 'branch_id', 'branches', 'id', 'FK_kot_branch'],
      [
        'kitchen_order_tickets',
        'station_id',
        'kitchen_stations',
        'id',
        'FK_kot_station',
      ],
      [
        'kitchen_order_ticket_items',
        'ticket_id',
        'kitchen_order_tickets',
        'id',
        'FK_koti_ticket',
      ],
      ['kitchen_meal_plans', 'branch_id', 'branches', 'id', 'FK_kmp_branch'],
      [
        'kitchen_production_batches',
        'meal_plan_id',
        'kitchen_meal_plans',
        'id',
        'FK_kpb_plan',
      ],
      [
        'kitchen_production_batches',
        'meal_item_id',
        'meal_items',
        'id',
        'FK_kpb_meal_item',
      ],
      [
        'kitchen_production_batches',
        'product_id',
        'products',
        'id',
        'FK_kpb_product',
      ],
      [
        'kitchen_production_batches',
        'station_id',
        'kitchen_stations',
        'id',
        'FK_kpb_station',
      ],
      [
        'kitchen_batch_adjustments',
        'batch_id',
        'kitchen_production_batches',
        'id',
        'FK_kba_batch',
      ],
      [
        'kitchen_consumption_sessions',
        'branch_id',
        'branches',
        'id',
        'FK_kcs_branch',
      ],
      [
        'kitchen_consumption_sessions',
        'station_id',
        'kitchen_stations',
        'id',
        'FK_kcs_station',
      ],
      [
        'kitchen_consumption_lines',
        'session_id',
        'kitchen_consumption_sessions',
        'id',
        'FK_kcl_session',
      ],
      [
        'kitchen_consumption_lines',
        'product_id',
        'products',
        'id',
        'FK_kcl_product',
      ],
      [
        'kitchen_consumption_lines',
        'unit_id',
        'measurement_units',
        'id',
        'FK_kcl_unit',
      ],
      ['kitchen_assignments', 'branch_id', 'branches', 'id', 'FK_ka_branch'],
      [
        'kitchen_assignments',
        'employee_id',
        'employees',
        'id',
        'FK_ka_employee',
      ],
      [
        'kitchen_assignments',
        'station_id',
        'kitchen_stations',
        'id',
        'FK_ka_station',
      ],
      [
        'kitchen_assignments',
        'batch_id',
        'kitchen_production_batches',
        'id',
        'FK_ka_batch',
      ],
      [
        'kitchen_stock_shortages',
        'session_id',
        'kitchen_consumption_sessions',
        'id',
        'FK_kss_session',
      ],
      [
        'kitchen_stock_shortages',
        'branch_id',
        'branches',
        'id',
        'FK_kss_branch',
      ],
      [
        'kitchen_stock_shortages',
        'product_id',
        'products',
        'id',
        'FK_kss_product',
      ],
    ];
    for (const [table, column, refTable, refColumn, name] of foreignKeys) {
      await queryRunner.query(
        `DO $$ BEGIN ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kitchen_consumption_export_reference" ON "stock_receipt_export" ("reference_type", "reference_id") WHERE "reference_type" = 'kitchen_consumption_session'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_kitchen_consumption_export_reference"`,
    );
    for (const table of [
      'kitchen_stock_shortages',
      'kitchen_assignments',
      'kitchen_consumption_lines',
      'kitchen_consumption_sessions',
      'kitchen_batch_adjustments',
      'kitchen_production_batches',
      'kitchen_meal_plans',
      'kitchen_order_ticket_items',
      'kitchen_order_tickets',
      'kitchen_service_periods',
      'kitchen_recipe_items',
      'kitchen_recipes',
      'kitchen_product_stations',
      'kitchen_stations',
    ])
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN IF EXISTS "user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "base_unit_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "measurement_units" CASCADE`);
  }
}
