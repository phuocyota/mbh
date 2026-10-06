import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVietinBankBranchConfigs1763500000000 implements MigrationInterface {
  name = 'AddVietinBankBranchConfigs1763500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vietinbank_integration_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        "branch_id" uuid NOT NULL,
        "environment" varchar(10) NOT NULL,
        "provider_id" varchar(50) NOT NULL,
        "merchant_id" varchar(50) NOT NULL,
        "product_id" varchar(50) NULL,
        "gateway_id" varchar(100) NULL,
        "username" varchar(100) NULL,
        "client_id" varchar(255) NOT NULL,
        "client_secret_ref" varchar(500) NOT NULL,
        "partner_private_key_ref" varchar(500) NOT NULL,
        "partner_public_key" text NULL,
        "bank_public_key" text NOT NULL,
        "api_base_url" varchar(500) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_vietinbank_integration_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vietinbank_config_branch_environment"
          UNIQUE ("branch_id", "environment"),
        CONSTRAINT "CHK_vietinbank_config_environment"
          CHECK ("environment" IN ('UAT', 'PROD')),
        CONSTRAINT "CHK_vietinbank_config_status"
          CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT "FK_vietinbank_config_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vietinbank_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        "integration_config_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "account_number" varchar(100) NOT NULL,
        "account_name" varchar(255) NULL,
        "account_type" varchar(50) NULL,
        "priority" integer NOT NULL DEFAULT 0,
        "is_default" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_vietinbank_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_vietinbank_account_status"
          CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT "FK_vietinbank_account_config"
          FOREIGN KEY ("integration_config_id")
          REFERENCES "vietinbank_integration_configs"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vietinbank_account_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vietinbank_account_config"
      ON "vietinbank_accounts" ("integration_config_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vietinbank_default_account"
      ON "vietinbank_accounts" ("integration_config_id")
      WHERE "is_default" = true
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vietinbank_secrets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" varchar NULL,
        "updated_by" varchar NULL,
        "ref" varchar(500) NOT NULL,
        "ciphertext" text NOT NULL,
        "iv" varchar(64) NOT NULL,
        "auth_tag" varchar(64) NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_vietinbank_secrets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vietinbank_secret_ref" UNIQUE ("ref")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "vietinbank_topup_requests"
      ADD COLUMN IF NOT EXISTS "branch_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "vietinbank_config_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "vietinbank_account_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "vietinbank_topup_requests"
      ADD CONSTRAINT "FK_vietinbank_topup_branch" FOREIGN KEY ("branch_id")
        REFERENCES "branches"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "FK_vietinbank_topup_config"
        FOREIGN KEY ("vietinbank_config_id")
        REFERENCES "vietinbank_integration_configs"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "FK_vietinbank_topup_account"
        FOREIGN KEY ("vietinbank_account_id")
        REFERENCES "vietinbank_accounts"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vietinbank_topup_requests" DROP CONSTRAINT IF EXISTS "FK_vietinbank_topup_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vietinbank_topup_requests" DROP CONSTRAINT IF EXISTS "FK_vietinbank_topup_config"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vietinbank_topup_requests" DROP CONSTRAINT IF EXISTS "FK_vietinbank_topup_branch"`,
    );
    await queryRunner.query(`
      ALTER TABLE "vietinbank_topup_requests"
      DROP COLUMN IF EXISTS "vietinbank_account_id",
      DROP COLUMN IF EXISTS "vietinbank_config_id",
      DROP COLUMN IF EXISTS "branch_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "vietinbank_secrets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vietinbank_accounts"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "vietinbank_integration_configs"`,
    );
  }
}
