import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrderNumberToOrders1704067206000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'order_number',
        type: 'integer',
        isNullable: true,
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'order_number');
  }
}
