import { MigrationInterface, QueryRunner } from 'typeorm';

export class UppercaseStatusValues1704067212000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE orders
      SET status = CASE status
        WHEN 'Pending' THEN 'PENDING'
        WHEN 'waiting' THEN 'WAITING'
        WHEN 'cancelled' THEN 'CANCELLED'
        ELSE status
      END
      WHERE status IN ('Pending', 'waiting', 'cancelled')
    `);

    await queryRunner.query(`
      UPDATE payrolls
      SET status = UPPER(status)
      WHERE status IN ('draft', 'estimated', 'finalized', 'cancelled')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE orders
      SET status = CASE status
        WHEN 'PENDING' THEN 'Pending'
        WHEN 'WAITING' THEN 'waiting'
        WHEN 'CANCELLED' THEN 'cancelled'
        ELSE status
      END
      WHERE status IN ('PENDING', 'WAITING', 'CANCELLED')
    `);

    await queryRunner.query(`
      UPDATE payrolls
      SET status = LOWER(status)
      WHERE status IN ('DRAFT', 'ESTIMATED', 'FINALIZED', 'CANCELLED')
    `);
  }
}
