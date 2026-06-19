import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWarehouseVouchers1704067227000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouse_voucher_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouse_vouchers"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "warehouse_vouchers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "code" character varying NOT NULL,
        "type" character varying NOT NULL,
        "supplier_id" uuid,
        "order_id" uuid,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "fund_id" uuid,
        "money_voucher_id" uuid,
        "note" text,
        CONSTRAINT "UQ_warehouse_vouchers_code" UNIQUE ("code"),
        CONSTRAINT "PK_warehouse_vouchers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "warehouse_voucher_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "voucher_id" uuid NOT NULL,
        "inventory_item_id" uuid,
        "product_id" uuid,
        "quantity" numeric(12,2) NOT NULL,
        "unit_price" numeric(15,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "PK_warehouse_voucher_items" PRIMARY KEY ("id")
      )
    `);
  }
}
