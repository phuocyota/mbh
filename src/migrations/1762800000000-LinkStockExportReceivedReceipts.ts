import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkStockExportReceivedReceipts1762800000000
  implements MigrationInterface
{
  name = 'LinkStockExportReceivedReceipts1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      ALTER TABLE "fund_receipt_received"
      ADD COLUMN IF NOT EXISTS "money_voucher_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_fund_receipt_received_money_voucher_id'
            AND conrelid = '"fund_receipt_received"'::regclass
        ) THEN
          ALTER TABLE "fund_receipt_received"
          ADD CONSTRAINT "FK_fund_receipt_received_money_voucher_id"
          FOREIGN KEY ("money_voucher_id") REFERENCES "money_vouchers"("id")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fund_receipt_received_money_voucher_id"
      ON "fund_receipt_received" ("money_voucher_id")
    `);

    await queryRunner.query(`
      WITH candidates AS (
        SELECT
          received.id AS received_id,
          voucher.id AS voucher_id,
          ROW_NUMBER() OVER (
            PARTITION BY voucher.id
            ORDER BY ABS(EXTRACT(EPOCH FROM (received.created_at - voucher.created_at)))
          ) AS rn
        FROM "money_vouchers" voucher
        INNER JOIN "funds" fund ON fund.id = voucher.fund_id
        INNER JOIN "fund_receipt_received" received
          ON received.money_voucher_id IS NULL
          AND received.fund_id = voucher.fund_id
          AND received.branch_id = fund.branch_id
          AND received.amount = voucher.amount
          AND COALESCE(received.order_id::text, '') = COALESCE(voucher.order_id::text, '')
          AND COALESCE(received.note, '') = COALESCE(voucher.note, voucher.purpose, '')
        WHERE voucher.type = 'RECEIPT'
          AND voucher.purpose = 'STOCK_EXPORT'
          AND voucher.ref_type IN ('ORDER', 'STOCK_VOUCHER', 'STOCK_RECEIPT_DETAIL')
      )
      UPDATE "fund_receipt_received" received
      SET
        "money_voucher_id" = candidates.voucher_id,
        "updated_at" = now()
      FROM candidates
      WHERE received.id = candidates.received_id
        AND candidates.rn = 1
    `);

    await queryRunner.query(`
      WITH missing AS (
        SELECT
          voucher.id AS money_voucher_id,
          fund.branch_id,
          voucher.amount,
          voucher.fund_id,
          voucher.order_id,
          COALESCE(voucher.note, voucher.purpose) AS note,
          ROW_NUMBER() OVER (ORDER BY voucher.created_at, voucher.id) AS seq
        FROM "money_vouchers" voucher
        INNER JOIN "funds" fund ON fund.id = voucher.fund_id
        WHERE voucher.type = 'RECEIPT'
          AND voucher.purpose = 'STOCK_EXPORT'
          AND voucher.ref_type IN ('ORDER', 'STOCK_VOUCHER', 'STOCK_RECEIPT_DETAIL')
          AND NOT EXISTS (
            SELECT 1
            FROM "fund_receipt_received" received
            WHERE received.money_voucher_id = voucher.id
          )
      ),
      inserted AS (
        INSERT INTO "fund_receipt_received" (
          "id",
          "created_at",
          "updated_at",
          "code",
          "branch_id",
          "amount",
          "fund_id",
          "order_id",
          "money_voucher_id",
          "status",
          "note"
        )
        SELECT
          uuid_generate_v4(),
          now(),
          now(),
          'PT' || to_char(now(), 'YYYYMMDDHH24MISS') || lpad(seq::text, 4, '0'),
          branch_id,
          amount,
          fund_id,
          order_id,
          money_voucher_id,
          'COMPLETED',
          note
        FROM missing
        RETURNING id, money_voucher_id, amount, fund_id, note
      )
      INSERT INTO "fund_detail" (
        "id",
        "created_at",
        "updated_at",
        "amount",
        "type",
        "category",
        "fund_id",
        "received_id",
        "note"
      )
      SELECT
        uuid_generate_v4(),
        now(),
        now(),
        inserted.amount,
        'RECEIVED',
        'STOCK_EXPORT',
        inserted.fund_id,
        inserted.id,
        inserted.note
      FROM inserted
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_fund_receipt_received_money_voucher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "fund_receipt_received"
      DROP CONSTRAINT IF EXISTS "FK_fund_receipt_received_money_voucher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "fund_receipt_received"
      DROP COLUMN IF EXISTS "money_voucher_id"
    `);
  }
}
