import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVietinBankTopups1763400000000 implements MigrationInterface {
  name = 'AddVietinBankTopups1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vietinbank_topup_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        "request_id" uuid NOT NULL,
        "payment_code" varchar(32) NOT NULL,
        "customer_id" uuid NOT NULL,
        "balance_at_creation" numeric(12,2) NOT NULL,
        "target_balance" numeric(12,2) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "qr_content" text NULL,
        "qr_base64" text NULL,
        "bank_account_number" varchar(64) NOT NULL,
        "bank_account_name" varchar(255) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'PENDING',
        "expires_at" TIMESTAMPTZ NOT NULL,
        "completed_at" TIMESTAMPTZ NULL,
        "failure_reason" text NULL,
        CONSTRAINT "PK_vietinbank_topup_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vietinbank_topup_request_id" UNIQUE ("request_id"),
        CONSTRAINT "UQ_vietinbank_topup_payment_code" UNIQUE ("payment_code"),
        CONSTRAINT "FK_vietinbank_topup_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vietinbank_topup_customer_status"
      ON "vietinbank_topup_requests" ("customer_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vietinbank_bank_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        "trans_id" varchar(128) NOT NULL,
        "bank_trans_id" varchar(128) NOT NULL,
        "topup_request_id" uuid NOT NULL,
        "payment_code" varchar(32) NOT NULL,
        "send_account_id" varchar(128) NULL,
        "recv_account_id" varchar(128) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "remark" text NULL,
        "trans_time" varchar(32) NOT NULL,
        "status" varchar(32) NOT NULL,
        "balance_before" numeric(12,2) NOT NULL,
        "balance_after" numeric(12,2) NOT NULL,
        "raw_request" jsonb NOT NULL,
        "received_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_vietinbank_bank_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vietinbank_bank_trans_id" UNIQUE ("trans_id"),
        CONSTRAINT "FK_vietinbank_bank_topup" FOREIGN KEY ("topup_request_id")
          REFERENCES "vietinbank_topup_requests"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vietinbank_bank_transaction_topup"
      ON "vietinbank_bank_transactions" ("topup_request_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "vietinbank_bank_transactions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "vietinbank_topup_requests"`);
  }
}
