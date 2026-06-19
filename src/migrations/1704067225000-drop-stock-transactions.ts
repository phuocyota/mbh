import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class DropStockTransactions1704067225000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('stock_transactions', true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'stock_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'branch_id',
            type: 'uuid',
            default: "'00000000-0000-0000-0000-000000000001'",
          },
          {
            name: 'product_id',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'varchar',
          },
          {
            name: 'quantity',
            type: 'numeric',
            precision: 12,
            scale: 2,
          },
          {
            name: 'ref_type',
            type: 'varchar',
          },
          {
            name: 'ref_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_by',
            type: 'varchar',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('stock_transactions', [
      new TableForeignKey({
        columnNames: ['branch_id'],
        referencedTableName: 'branches',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
      new TableForeignKey({
        columnNames: ['product_id'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    ]);
  }
}
