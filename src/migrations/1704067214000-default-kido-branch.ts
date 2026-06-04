import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_BRANCH_ID,
  DEFAULT_BRANCH_NAME,
} from '../common/constant/default-branch.constant';

export class DefaultKidoBranch1704067214000 implements MigrationInterface {
  private readonly branchTables = [
    'carts',
    'orders',
    'kitchen_tickets',
    'stock_transactions',
    'stock_levels',
    'shifts',
    'pos_devices',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO branches (id, name, address, status, created_at, updated_at)
        VALUES ($1, $2, NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
      `,
      [DEFAULT_BRANCH_ID, DEFAULT_BRANCH_NAME],
    );

    for (const tableName of this.branchTables) {
      if (!(await queryRunner.hasTable(tableName))) {
        continue;
      }

      const table = await queryRunner.getTable(tableName);
      if (!table?.findColumnByName('branch_id')) {
        continue;
      }

      await queryRunner.query(
        `UPDATE "${tableName}" SET branch_id = $1 WHERE branch_id IS NULL`,
        [DEFAULT_BRANCH_ID],
      );
      await queryRunner.query(
        `ALTER TABLE "${tableName}" ALTER COLUMN branch_id SET DEFAULT '${DEFAULT_BRANCH_ID}'::uuid`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of this.branchTables) {
      if (!(await queryRunner.hasTable(tableName))) {
        continue;
      }

      const table = await queryRunner.getTable(tableName);
      if (!table?.findColumnByName('branch_id')) {
        continue;
      }

      await queryRunner.query(
        `ALTER TABLE "${tableName}" ALTER COLUMN branch_id DROP DEFAULT`,
      );
    }
  }
}
