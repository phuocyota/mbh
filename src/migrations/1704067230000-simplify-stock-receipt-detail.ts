import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyStockReceiptDetail1704067230000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop constraints from stock_receipt_detail
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_branch",
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_supplier",
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_order",
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_fund",
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_money_voucher"
    `);

    // 2. Drop columns from stock_receipt_detail
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        DROP COLUMN IF EXISTS "branch_id",
        DROP COLUMN IF EXISTS "supplier_id",
        DROP COLUMN IF EXISTS "order_id",
        DROP COLUMN IF EXISTS "fund_id",
        DROP COLUMN IF EXISTS "money_voucher_id",
        DROP COLUMN IF EXISTS "unit_price",
        DROP COLUMN IF EXISTS "total_amount",
        DROP COLUMN IF EXISTS "type",
        DROP COLUMN IF EXISTS "note"
    `);

    // 3. Add new columns
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        ADD COLUMN IF NOT EXISTS "receipt_type" character varying NOT NULL DEFAULT 'IMPORT',
        ADD COLUMN IF NOT EXISTS "from_id" uuid,
        ADD COLUMN IF NOT EXISTS "to_id" uuid,
        ADD COLUMN IF NOT EXISTS "from_type" character varying NOT NULL DEFAULT 'VENDOR',
        ADD COLUMN IF NOT EXISTS "to_type" character varying NOT NULL DEFAULT 'STOCK',
        ADD COLUMN IF NOT EXISTS "transfer_id" uuid
    `);

    // Remove the default values we set just to avoid errors during ADD COLUMN IF NOT EXISTS
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        ALTER COLUMN "receipt_type" DROP DEFAULT,
        ALTER COLUMN "from_type" DROP DEFAULT,
        ALTER COLUMN "to_type" DROP DEFAULT
    `);

    // 4. Add foreign key for transfer_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_transfer') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_transfer" FOREIGN KEY ("transfer_id") REFERENCES "stock_receipt_transfer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new constraints and columns
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        DROP CONSTRAINT IF EXISTS "FK_stock_receipt_detail_transfer",
        DROP COLUMN IF EXISTS "transfer_id",
        DROP COLUMN IF EXISTS "to_type",
        DROP COLUMN IF EXISTS "from_type",
        DROP COLUMN IF EXISTS "to_id",
        DROP COLUMN IF EXISTS "from_id",
        DROP COLUMN IF EXISTS "receipt_type"
    `);

    // Restore old columns
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        ADD COLUMN IF NOT EXISTS "supplier_id" uuid,
        ADD COLUMN IF NOT EXISTS "order_id" uuid,
        ADD COLUMN IF NOT EXISTS "fund_id" uuid,
        ADD COLUMN IF NOT EXISTS "money_voucher_id" uuid,
        ADD COLUMN IF NOT EXISTS "unit_price" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "type" character varying NOT NULL DEFAULT 'IMPORT',
        ADD COLUMN IF NOT EXISTS "note" text
    `);

    // Restore old constraints
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_branch') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_supplier') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_order') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_fund') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_money_voucher') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_money_voucher" FOREIGN KEY ("money_voucher_id") REFERENCES "money_vouchers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }
}
