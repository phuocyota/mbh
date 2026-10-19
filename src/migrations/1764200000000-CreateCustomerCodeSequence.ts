import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerCodeSequence1764200000000 implements MigrationInterface {
  name = 'CreateCustomerCodeSequence1764200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SEQUENCE "customer_code_seq" START WITH 1');
    await queryRunner.query(`
      SELECT setval('customer_code_seq', GREATEST(COALESCE(MAX(
        SUBSTRING(customer_code FROM 3)::bigint
      ), 0) + 1, 1), false)
      FROM customers
      WHERE customer_code ~ '^KH[0-9]{1,15}$'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SEQUENCE "customer_code_seq"');
  }
}
