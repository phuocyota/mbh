import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductPriceHistory1704067240000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_price_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" character varying,
        "updated_by" character varying,
        "product_id" uuid NOT NULL,
        "old_price" numeric(12,2),
        "new_price" numeric(12,2) NOT NULL,
        "old_cost_price" numeric(12,2),
        "new_cost_price" numeric(12,2),
        "change_type" character varying NOT NULL DEFAULT 'UPDATE',
        "note" text,
        CONSTRAINT "PK_product_price_history" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_product_price_history_product'
        ) THEN
          ALTER TABLE "product_price_history"
            ADD CONSTRAINT "FK_product_price_history_product"
            FOREIGN KEY ("product_id") REFERENCES "products"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      INSERT INTO "product_price_history" (
        "product_id",
        "old_price",
        "new_price",
        "old_cost_price",
        "new_cost_price",
        "change_type",
        "note",
        "created_at",
        "updated_at"
      )
      SELECT
        p."id",
        NULL,
        p."price",
        NULL,
        p."cost_price",
        'INITIAL',
        'Initial price snapshot from products table',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM "products" p
      WHERE NOT EXISTS (
        SELECT 1
        FROM "product_price_history" h
        WHERE h."product_id" = p."id"
          AND h."change_type" = 'INITIAL'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_price_history"`);
  }
}
