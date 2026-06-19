import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropStockTakeAndTransfer1704067229000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the constraint on stock_receipt_transfer pointing to stock_transfers
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_transfer"
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_transfer_transfer"
    `);

    // 2. Drop the tables
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfer_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_take_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_takes" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create tables and constraints if rolled back
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "from_branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "to_branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "status" character varying NOT NULL DEFAULT 'DRAFT',
        "transferred_at" TIMESTAMP,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "UQ_stock_transfers_code" UNIQUE ("code"),
        CONSTRAINT "PK_stock_transfers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "transfer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" numeric(12,2) NOT NULL,
        "unit_cost" numeric(15,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "PK_stock_transfer_items" PRIMARY KEY ("id")
      )
    `);

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
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_transfers_from_branch') THEN
          ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_stock_transfers_from_branch" FOREIGN KEY ("from_branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_transfers_to_branch') THEN
          ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_stock_transfers_to_branch" FOREIGN KEY ("to_branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_transfer_items_transfer') THEN
          ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "FK_stock_transfer_items_transfer" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_transfer_items_product') THEN
          ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "FK_stock_transfer_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_transfer_transfer') THEN
          ALTER TABLE "stock_receipt_transfer" ADD CONSTRAINT "FK_stock_receipt_transfer_transfer" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }
}
