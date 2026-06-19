import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockReceiptImportExport1704067228000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create stock_receipt_import table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_receipt_import" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "supplier_id" uuid,
        "order_id" uuid,
        "fund_id" uuid,
        "money_voucher_id" uuid,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'COMPLETED',
        "note" text,
        CONSTRAINT "UQ_stock_receipt_import_code" UNIQUE ("code"),
        CONSTRAINT "PK_stock_receipt_import" PRIMARY KEY ("id")
      )
    `);

    // 2. Create stock_receipt_export table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_receipt_export" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "order_id" uuid,
        "fund_id" uuid,
        "money_voucher_id" uuid,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'COMPLETED',
        "note" text,
        CONSTRAINT "UQ_stock_receipt_export_code" UNIQUE ("code"),
        CONSTRAINT "PK_stock_receipt_export" PRIMARY KEY ("id")
      )
    `);

    // 3. Add import_id and export_id to stock_receipt_detail table
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        ADD COLUMN IF NOT EXISTS "import_id" uuid,
        ADD COLUMN IF NOT EXISTS "export_id" uuid
    `);

    // 4. Add foreign keys and constraints
    await queryRunner.query(`
      DO $$
      BEGIN
        -- stock_receipt_import constraints
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_import_branch') THEN
          ALTER TABLE "stock_receipt_import" ADD CONSTRAINT "FK_stock_receipt_import_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_import_supplier') THEN
          ALTER TABLE "stock_receipt_import" ADD CONSTRAINT "FK_stock_receipt_import_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_import_order') THEN
          ALTER TABLE "stock_receipt_import" ADD CONSTRAINT "FK_stock_receipt_import_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_import_fund') THEN
          ALTER TABLE "stock_receipt_import" ADD CONSTRAINT "FK_stock_receipt_import_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_import_money_voucher') THEN
          ALTER TABLE "stock_receipt_import" ADD CONSTRAINT "FK_stock_receipt_import_money_voucher" FOREIGN KEY ("money_voucher_id") REFERENCES "money_vouchers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;

        -- stock_receipt_export constraints
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_export_branch') THEN
          ALTER TABLE "stock_receipt_export" ADD CONSTRAINT "FK_stock_receipt_export_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_export_order') THEN
          ALTER TABLE "stock_receipt_export" ADD CONSTRAINT "FK_stock_receipt_export_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_export_fund') THEN
          ALTER TABLE "stock_receipt_export" ADD CONSTRAINT "FK_stock_receipt_export_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_export_money_voucher') THEN
          ALTER TABLE "stock_receipt_export" ADD CONSTRAINT "FK_stock_receipt_export_money_voucher" FOREIGN KEY ("money_voucher_id") REFERENCES "money_vouchers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;

        -- stock_receipt_detail links to headers
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_import') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_import" FOREIGN KEY ("import_id") REFERENCES "stock_receipt_import"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_export') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_export" FOREIGN KEY ("export_id") REFERENCES "stock_receipt_export"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_export",
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_import",
        DROP COLUMN IF EXISTS "export_id",
        DROP COLUMN IF EXISTS "import_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_receipt_export"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_receipt_import"`);
  }
}
