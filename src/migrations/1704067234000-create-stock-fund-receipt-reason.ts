import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockFundReceiptReason1704067234000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_fund_receipt_reason" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "stock_id" uuid,
        "fund_id" uuid,
        "reason" character varying NOT NULL,
        "note" text,
        "status" character varying NOT NULL DEFAULT 'active',
        CONSTRAINT "PK_stock_fund_receipt_reason" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_fund_receipt_reason_stock') THEN
          ALTER TABLE "stock_fund_receipt_reason" ADD CONSTRAINT "FK_stock_fund_receipt_reason_stock" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_fund_receipt_reason_fund') THEN
          ALTER TABLE "stock_fund_receipt_reason" ADD CONSTRAINT "FK_stock_fund_receipt_reason_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_fund_receipt_reason"`);
  }
}
