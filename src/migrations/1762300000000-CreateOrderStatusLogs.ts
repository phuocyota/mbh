import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderStatusLogs1762300000000 implements MigrationInterface {
  name = 'CreateOrderStatusLogs1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_status_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" varchar,
        "updated_by" varchar,
        "order_id" uuid NOT NULL,
        "old_status" int,
        "new_status" int NOT NULL,
        "changed_by" varchar,
        "reason" text,
        CONSTRAINT "PK_order_status_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_order_status_logs_order_id'
            AND conrelid = '"order_status_logs"'::regclass
        ) THEN
          ALTER TABLE "order_status_logs"
          ADD CONSTRAINT "FK_order_status_logs_order_id"
          FOREIGN KEY ("order_id") REFERENCES "orders"("id")
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_status_logs_order_id_created_at"
      ON "order_status_logs" ("order_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_order_status_logs_order_id_created_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "order_status_logs"
      DROP CONSTRAINT IF EXISTS "FK_order_status_logs_order_id"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "order_status_logs"
    `);
  }
}
