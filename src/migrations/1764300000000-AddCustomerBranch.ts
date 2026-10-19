import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerBranch1764300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id uuid',
    );
    // Only backfill customers whose linked user identifies the branch.
    // Manually created legacy customers must be assigned after verification.
    await queryRunner.query(`
      UPDATE customers c SET branch_id = u.branch_id
      FROM users u
      WHERE c.user_id = u.id AND c.branch_id IS NULL AND u.branch_id IS NOT NULL
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON customers(branch_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_customers_branch_id');
    await queryRunner.query(
      'ALTER TABLE customers DROP COLUMN IF EXISTS branch_id',
    );
  }
}
