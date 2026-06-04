import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddBranchToUsers1704067215000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const hasBranchId = table?.findColumnByName('branch_id');

    if (!hasBranchId) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'branch_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(`
      UPDATE users
      SET branch_id = '11111111-1111-4111-8111-111111111111'
      WHERE role = 'MANAGER'
        AND branch_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM branches
          WHERE id = '11111111-1111-4111-8111-111111111111'
        )
    `);

    const refreshedTable = await queryRunner.getTable('users');
    const hasForeignKey = refreshedTable?.foreignKeys.some(
      (foreignKey) => foreignKey.columnNames.length === 1 &&
        foreignKey.columnNames[0] === 'branch_id',
    );

    if (!hasForeignKey) {
      await queryRunner.createForeignKey(
        'users',
        new TableForeignKey({
          columnNames: ['branch_id'],
          referencedTableName: 'branches',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const foreignKey = table?.foreignKeys.find(
      (key) => key.columnNames.length === 1 && key.columnNames[0] === 'branch_id',
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('users', foreignKey);
    }

    if (table?.findColumnByName('branch_id')) {
      await queryRunner.dropColumn('users', 'branch_id');
    }
  }
}
