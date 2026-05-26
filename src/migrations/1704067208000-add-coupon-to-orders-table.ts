import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddCouponToOrdersTable1704067208000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add coupon_id column
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'coupon_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add coupon_discount column
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'coupon_discount',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
      }),
    );

    // Add foreign key for coupon_id
    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['coupon_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'coupons',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key
    const table = await queryRunner.getTable('orders');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('coupon_id') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('orders', foreignKey);
      }
    }

    // Remove columns
    await queryRunner.dropColumn('orders', 'coupon_discount');
    await queryRunner.dropColumn('orders', 'coupon_id');
  }
}
