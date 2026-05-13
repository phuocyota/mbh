import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class ChangeCouponsUserToCustomer1704067209000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('coupons');
    if (!table) {
      return;
    }

    const hasCustomerId = table.columns.some((column) => column.name === 'customer_id');
    const hasUserId = table.columns.some((column) => column.name === 'user_id');

    if (!hasCustomerId) {
      await queryRunner.addColumn(
        'coupons',
        new TableColumn({
          name: 'customer_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    if (hasUserId) {
      await queryRunner.query(`
        update coupons c
        set customer_id = cu.id
        from customers cu
        where c.user_id = cu.user_id
          and c.customer_id is null
      `);
    }

    await queryRunner.query(`
      delete from coupons
      where customer_id is null
    `);

    const refreshedTable = await queryRunner.getTable('coupons');
    if (!refreshedTable) {
      return;
    }

    for (const foreignKey of refreshedTable.foreignKeys) {
      if (
        foreignKey.columnNames.includes('user_id') ||
        foreignKey.columnNames.includes('customer_id')
      ) {
        await queryRunner.dropForeignKey('coupons', foreignKey);
      }
    }

    if (hasUserId) {
      await queryRunner.dropColumn('coupons', 'user_id');
    }

    const customerIdColumn = (await queryRunner.getTable('coupons'))?.findColumnByName(
      'customer_id',
    );
    if (customerIdColumn?.isNullable) {
      await queryRunner.changeColumn(
        'coupons',
        'customer_id',
        new TableColumn({
          name: 'customer_id',
          type: 'uuid',
          isNullable: false,
        }),
      );
    }

    await queryRunner.createForeignKey(
      'coupons',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('coupons');
    if (!table) {
      return;
    }

    const hasUserId = table.columns.some((column) => column.name === 'user_id');
    const hasCustomerId = table.columns.some((column) => column.name === 'customer_id');

    if (!hasUserId) {
      await queryRunner.addColumn(
        'coupons',
        new TableColumn({
          name: 'user_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    if (hasCustomerId) {
      await queryRunner.query(`
        update coupons c
        set user_id = cu.user_id
        from customers cu
        where c.customer_id = cu.id
          and c.user_id is null
      `);
    }

    await queryRunner.query(`
      delete from coupons
      where user_id is null
    `);

    const refreshedTable = await queryRunner.getTable('coupons');
    if (!refreshedTable) {
      return;
    }

    for (const foreignKey of refreshedTable.foreignKeys) {
      if (
        foreignKey.columnNames.includes('customer_id') ||
        foreignKey.columnNames.includes('user_id')
      ) {
        await queryRunner.dropForeignKey('coupons', foreignKey);
      }
    }

    if (hasCustomerId) {
      await queryRunner.dropColumn('coupons', 'customer_id');
    }

    const userIdColumn = (await queryRunner.getTable('coupons'))?.findColumnByName(
      'user_id',
    );
    if (userIdColumn?.isNullable) {
      await queryRunner.changeColumn(
        'coupons',
        'user_id',
        new TableColumn({
          name: 'user_id',
          type: 'uuid',
          isNullable: false,
        }),
      );
    }

    await queryRunner.createForeignKey(
      'coupons',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }
}
