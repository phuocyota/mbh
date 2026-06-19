import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockReceiptTransfer1704067226000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_receipt_transfer" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "transfer_id" uuid NOT NULL,
        "from_branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "to_branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "status" character varying NOT NULL DEFAULT 'DRAFT',
        "received_at" TIMESTAMP,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "UQ_stock_receipt_transfer_code" UNIQUE ("code"),
        CONSTRAINT "PK_stock_receipt_transfer" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_receipt_detail" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "product_id" uuid NOT NULL,
        "supplier_id" uuid,
        "order_id" uuid,
        "fund_id" uuid,
        "money_voucher_id" uuid,
        "quantity" numeric(12,2) NOT NULL,
        "unit_price" numeric(15,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "type" character varying NOT NULL,
        "note" text,
        CONSTRAINT "PK_stock_receipt_detail" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_transfer_transfer') THEN
          ALTER TABLE "stock_receipt_transfer" ADD CONSTRAINT "FK_stock_receipt_transfer_transfer" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_transfer_from_branch') THEN
          ALTER TABLE "stock_receipt_transfer" ADD CONSTRAINT "FK_stock_receipt_transfer_from_branch" FOREIGN KEY ("from_branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_transfer_to_branch') THEN
          ALTER TABLE "stock_receipt_transfer" ADD CONSTRAINT "FK_stock_receipt_transfer_to_branch" FOREIGN KEY ("to_branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_receipt_detail_product') THEN
          ALTER TABLE "stock_receipt_detail" ADD CONSTRAINT "FK_stock_receipt_detail_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
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
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_receipt_detail"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_receipt_transfer"`);
  }
}
