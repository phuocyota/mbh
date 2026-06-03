import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertOrderStatusToNumber1704067213000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN status DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN status TYPE integer USING (
        CASE status
          WHEN 'CANCELLED' THEN 0
          WHEN 'cancelled' THEN 0
          WHEN 'PREPARING' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'Pending' THEN 2
          WHEN 'PENDING_PAYMENT' THEN 3
          WHEN 'READY_TO_PICKUP' THEN 4
          WHEN 'DONE' THEN 5
          WHEN 'REFUNDED' THEN 6
          WHEN 'DRAFT' THEN 7
          WHEN 'WAITING' THEN 8
          WHEN 'waiting' THEN 8
          WHEN 'READY' THEN 9
          WHEN 'RECEIVED' THEN 10
          WHEN 'COMPLETED' THEN 11
          ELSE 2
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN status SET DEFAULT 2
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN status DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN status TYPE varchar USING (
        CASE status
          WHEN 0 THEN 'CANCELLED'
          WHEN 1 THEN 'PREPARING'
          WHEN 2 THEN 'PENDING'
          WHEN 3 THEN 'PENDING_PAYMENT'
          WHEN 4 THEN 'READY_TO_PICKUP'
          WHEN 5 THEN 'DONE'
          WHEN 6 THEN 'REFUNDED'
          WHEN 7 THEN 'DRAFT'
          WHEN 8 THEN 'WAITING'
          WHEN 9 THEN 'READY'
          WHEN 10 THEN 'RECEIVED'
          WHEN 11 THEN 'COMPLETED'
          ELSE 'PENDING'
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN status SET DEFAULT 'PENDING'
    `);
  }
}
