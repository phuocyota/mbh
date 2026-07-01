import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeProductSkuNullable1704067245000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "sku" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "products"
      SET "sku" = 'PRD-' || "id"::text
      WHERE "sku" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "sku" SET NOT NULL
    `);
  }
}
