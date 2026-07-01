import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeProductUnitNullable1704067246000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "unit" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "products"
      SET "unit" = ''
      WHERE "unit" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "unit" SET NOT NULL
    `);
  }
}
