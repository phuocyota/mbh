import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropKitchenTickets1704067235000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "kitchen_ticket_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kitchen_tickets"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "order_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        "status" character varying NOT NULL DEFAULT 'WAITING',
        CONSTRAINT "PK_kitchen_tickets" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_ticket_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "kitchen_ticket_id" uuid NOT NULL,
        "order_item_id" uuid NOT NULL,
        "product_name" character varying NOT NULL,
        "quantity" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'WAITING',
        CONSTRAINT "PK_kitchen_ticket_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_kitchen_tickets_order') THEN
          ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "FK_kitchen_tickets_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_kitchen_tickets_branch') THEN
          ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "FK_kitchen_tickets_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_kitchen_ticket_items_ticket') THEN
          ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "FK_kitchen_ticket_items_ticket" FOREIGN KEY ("kitchen_ticket_id") REFERENCES "kitchen_tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_kitchen_ticket_items_order_item') THEN
          ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "FK_kitchen_ticket_items_order_item" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }
}
