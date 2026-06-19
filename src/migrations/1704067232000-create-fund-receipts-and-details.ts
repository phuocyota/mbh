import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFundReceiptsAndDetails1704067232000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create fund_receipt_received
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fund_receipt_received" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "amount" numeric(15,2) NOT NULL DEFAULT 0,
        "fund_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'COMPLETED',
        "note" text,
        CONSTRAINT "UQ_fund_receipt_received_code" UNIQUE ("code"),
        CONSTRAINT "PK_fund_receipt_received" PRIMARY KEY ("id")
      )
    `);

    // 2. Create fund_receipt_paid
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fund_receipt_paid" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "amount" numeric(15,2) NOT NULL DEFAULT 0,
        "fund_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'COMPLETED',
        "note" text,
        CONSTRAINT "UQ_fund_receipt_paid_code" UNIQUE ("code"),
        CONSTRAINT "PK_fund_receipt_paid" PRIMARY KEY ("id")
      )
    `);

    // 3. Create fund_receipt_transfer
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fund_receipt_transfer" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "code" character varying NOT NULL,
        "amount" numeric(15,2) NOT NULL DEFAULT 0,
        "from_fund_id" uuid NOT NULL,
        "to_fund_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'COMPLETED',
        "note" text,
        CONSTRAINT "UQ_fund_receipt_transfer_code" UNIQUE ("code"),
        CONSTRAINT "PK_fund_receipt_transfer" PRIMARY KEY ("id")
      )
    `);

    // 4. Create fund_detail
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fund_detail" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "amount" numeric(15,2) NOT NULL,
        "type" character varying NOT NULL,
        "category" character varying NOT NULL,
        "fund_id" uuid NOT NULL,
        "received_id" uuid,
        "paid_id" uuid,
        "transfer_id" uuid,
        "note" text,
        CONSTRAINT "PK_fund_detail" PRIMARY KEY ("id")
      )
    `);

    // 5. Add foreign keys
    await queryRunner.query(`
      DO $$
      BEGIN
        -- FKs for fund_receipt_received
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_received_branch') THEN
          ALTER TABLE "fund_receipt_received" ADD CONSTRAINT "FK_received_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_received_fund') THEN
          ALTER TABLE "fund_receipt_received" ADD CONSTRAINT "FK_received_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;

        -- FKs for fund_receipt_paid
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_paid_branch') THEN
          ALTER TABLE "fund_receipt_paid" ADD CONSTRAINT "FK_paid_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_paid_fund') THEN
          ALTER TABLE "fund_receipt_paid" ADD CONSTRAINT "FK_paid_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;

        -- FKs for fund_receipt_transfer
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_transfer_from_fund') THEN
          ALTER TABLE "fund_receipt_transfer" ADD CONSTRAINT "FK_transfer_from_fund" FOREIGN KEY ("from_fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_transfer_to_fund') THEN
          ALTER TABLE "fund_receipt_transfer" ADD CONSTRAINT "FK_transfer_to_fund" FOREIGN KEY ("to_fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;

        -- FKs for fund_detail
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_detail_fund') THEN
          ALTER TABLE "fund_detail" ADD CONSTRAINT "FK_detail_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_detail_received') THEN
          ALTER TABLE "fund_detail" ADD CONSTRAINT "FK_detail_received" FOREIGN KEY ("received_id") REFERENCES "fund_receipt_received"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_detail_paid') THEN
          ALTER TABLE "fund_detail" ADD CONSTRAINT "FK_detail_paid" FOREIGN KEY ("paid_id") REFERENCES "fund_receipt_paid"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_detail_transfer') THEN
          ALTER TABLE "fund_detail" ADD CONSTRAINT "FK_detail_transfer" FOREIGN KEY ("transfer_id") REFERENCES "fund_receipt_transfer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fund_detail"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fund_receipt_transfer"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fund_receipt_paid"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fund_receipt_received"`);
  }
}
