import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductIngredientsAndPriceDefault1704067248000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "ingredients" text
    `);

    await queryRunner.query(`
      UPDATE "products"
      SET "price" = 0
      WHERE "price" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "price" SET DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "price" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN IF EXISTS "ingredients"
    `);
  }
}
