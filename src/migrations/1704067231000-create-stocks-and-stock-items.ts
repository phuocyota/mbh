import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStocksAndStockItems1704067231000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create stocks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stocks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "name" character varying NOT NULL,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "address" text,
        "note" text,
        CONSTRAINT "PK_stocks" PRIMARY KEY ("id")
      )
    `);

    // 2. Create stock_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "stock_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" numeric(12,2) NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_stock_items_stock_product" UNIQUE ("stock_id", "product_id"),
        CONSTRAINT "PK_stock_items" PRIMARY KEY ("id")
      )
    `);

    // 3. Add foreign keys and constraints
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stocks_branch') THEN
          ALTER TABLE "stocks" ADD CONSTRAINT "FK_stocks_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_items_stock') THEN
          ALTER TABLE "stock_items" ADD CONSTRAINT "FK_stock_items_stock" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_items_product') THEN
          ALTER TABLE "stock_items" ADD CONSTRAINT "FK_stock_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stocks"`);
  }
}
