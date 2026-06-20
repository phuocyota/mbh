import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecreateStockTakes1704067233000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create stock_takes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_takes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "code" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'DRAFT',
        "counted_at" TIMESTAMP,
        "total_difference_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "increase_quantity" numeric(12,2) NOT NULL DEFAULT 0,
        "decrease_quantity" numeric(12,2) NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "UQ_stock_takes_code" UNIQUE ("code"),
        CONSTRAINT "PK_stock_takes" PRIMARY KEY ("id")
      )
    `);

    // 2. Create stock_take_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_take_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "stock_take_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "system_quantity" numeric(12,2) NOT NULL,
        "actual_quantity" numeric(12,2) NOT NULL,
        "difference_quantity" numeric(12,2) NOT NULL DEFAULT 0,
        "unit_cost" numeric(15,2) NOT NULL DEFAULT 0,
        "difference_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "PK_stock_take_items" PRIMARY KEY ("id")
      )
    `);

    // 3. Add foreign keys and constraints
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_takes_branch') THEN
          ALTER TABLE "stock_takes" ADD CONSTRAINT "FK_stock_takes_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_take_items_stock_take') THEN
          ALTER TABLE "stock_take_items" ADD CONSTRAINT "FK_stock_take_items_stock_take" FOREIGN KEY ("stock_take_id") REFERENCES "stock_takes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_take_items_product') THEN
          ALTER TABLE "stock_take_items" ADD CONSTRAINT "FK_stock_take_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // 4. Alter transfer_id column in stock_receipt_transfer to be NULLABLE
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_transfer" ALTER COLUMN "transfer_id" DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_transfer" ALTER COLUMN "transfer_id" SET NOT NULL;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_take_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_takes" CASCADE`);
  }
}
