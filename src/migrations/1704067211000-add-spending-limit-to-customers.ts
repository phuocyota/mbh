import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSpendingLimitToCustomers1704067211000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'customers',
      new TableColumn({
        name: 'spending_limit',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 50000,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('customers', 'spending_limit');
  }
}
