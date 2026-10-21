import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCustomerTotalDebtLimit1765200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Switch all existing customers from a remaining allowance to a fixed cap.
    // Wallet balances and transaction history must remain unchanged.
    await queryRunner.query(
      'ALTER TABLE customers ALTER COLUMN debt_limit SET DEFAULT 50000',
    );
    await queryRunner.query(
      'UPDATE customers SET debt_limit = 50000 WHERE debt_limit IS DISTINCT FROM 50000',
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'Cannot reconstruct historical remaining debt allowances. Restore a verified backup before reverting the debt policy.',
    );
  }
}
