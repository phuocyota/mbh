import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinanceWarehouseVouchers1704067220000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "funds" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by" character varying, "updated_by" character varying, "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001', "code" character varying NOT NULL, "name" character varying NOT NULL, "account_code" character varying NOT NULL, "balance" numeric(15,2) NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'active', CONSTRAINT "UQ_funds_code" UNIQUE ("code"), CONSTRAINT "PK_funds" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "money_vouchers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by" character varying, "updated_by" character varying, "code" character varying NOT NULL, "type" character varying NOT NULL, "fund_id" uuid NOT NULL, "amount" numeric(15,2) NOT NULL, "order_id" uuid, "supplier_id" uuid, "purpose" character varying, "ref_type" character varying, "ref_id" uuid, "note" text, CONSTRAINT "UQ_money_vouchers_code" UNIQUE ("code"), CONSTRAINT "PK_money_vouchers" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "fund_transactions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by" character varying, "updated_by" character varying, "fund_id" uuid NOT NULL, "type" character varying NOT NULL, "amount" numeric(15,2) NOT NULL, "balance_after" numeric(15,2) NOT NULL, "ref_type" character varying, "ref_id" uuid, "order_id" uuid, "note" text, CONSTRAINT "PK_fund_transactions" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "debts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_by" character varying, "updated_by" character varying, "supplier_id" uuid NOT NULL, "type" character varying NOT NULL, "amount" numeric(15,2) NOT NULL, "balance_after" numeric(15,2) NOT NULL, "ref_type" character varying, "ref_id" uuid, "note" text, CONSTRAINT "PK_debts" PRIMARY KEY ("id"))`);

    await queryRunner.query(`ALTER TABLE "funds" ADD CONSTRAINT "FK_funds_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "money_vouchers" ADD CONSTRAINT "FK_money_vouchers_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "money_vouchers" ADD CONSTRAINT "FK_money_vouchers_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "money_vouchers" ADD CONSTRAINT "FK_money_vouchers_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fund_transactions" ADD CONSTRAINT "FK_fund_transactions_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "debts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fund_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "money_vouchers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "funds"`);
  }
}
