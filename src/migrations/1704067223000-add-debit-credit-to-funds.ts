import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDebitCreditToFunds1704067223000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "debit" numeric(15,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "credit" numeric(15,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "funds" DROP COLUMN IF EXISTS "credit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" DROP COLUMN IF EXISTS "debit"`,
    );
  }
}
