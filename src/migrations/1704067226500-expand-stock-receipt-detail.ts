import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandStockReceiptDetail1704067226500
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        ADD COLUMN IF NOT EXISTS "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        ADD COLUMN IF NOT EXISTS "supplier_id" uuid,
        ADD COLUMN IF NOT EXISTS "order_id" uuid,
        ADD COLUMN IF NOT EXISTS "fund_id" uuid,
        ADD COLUMN IF NOT EXISTS "money_voucher_id" uuid,
        ADD COLUMN IF NOT EXISTS "unit_price" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "note" text
    `);

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_receipt_detail"
        DROP COLUMN IF EXISTS "note",
        DROP COLUMN IF EXISTS "total_amount",
        DROP COLUMN IF EXISTS "unit_price",
        DROP COLUMN IF EXISTS "money_voucher_id",
        DROP COLUMN IF EXISTS "fund_id",
        DROP COLUMN IF EXISTS "order_id",
        DROP COLUMN IF EXISTS "supplier_id",
        DROP COLUMN IF EXISTS "branch_id"
    `);
  }
}
