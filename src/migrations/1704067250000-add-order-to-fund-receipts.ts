import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderToFundReceipts1704067250000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fund_receipt_received" ADD COLUMN IF NOT EXISTS "order_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "fund_receipt_paid" ADD COLUMN IF NOT EXISTS "order_id" uuid`,
    );

    await queryRunner.query(`
      UPDATE "fund_receipt_received" receipt
      SET "order_id" = orders."id"
      FROM "orders" orders
      WHERE receipt."order_id" IS NULL
        AND receipt."note" IS NOT NULL
        AND POSITION(orders."order_code" IN receipt."note") > 0
    `);

    await queryRunner.query(`
      UPDATE "fund_receipt_paid" receipt
      SET "order_id" = orders."id"
      FROM "orders" orders
      WHERE receipt."order_id" IS NULL
        AND receipt."note" IS NOT NULL
        AND POSITION(orders."order_code" IN receipt."note") > 0
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_received_order') THEN
          ALTER TABLE "fund_receipt_received"
          ADD CONSTRAINT "FK_received_order"
          FOREIGN KEY ("order_id") REFERENCES "orders"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_paid_order') THEN
          ALTER TABLE "fund_receipt_paid"
          ADD CONSTRAINT "FK_paid_order"
          FOREIGN KEY ("order_id") REFERENCES "orders"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fund_receipt_paid"
      DROP CONSTRAINT IF EXISTS "FK_paid_order"
    `);
    await queryRunner.query(`
      ALTER TABLE "fund_receipt_received"
      DROP CONSTRAINT IF EXISTS "FK_received_order"
    `);
    await queryRunner.query(
      `ALTER TABLE "fund_receipt_paid" DROP COLUMN IF EXISTS "order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fund_receipt_received" DROP COLUMN IF EXISTS "order_id"`,
    );
  }
}
