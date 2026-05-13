import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentMethodToOrders1704067205000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'payment_method',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'payment_method');
  }
}
