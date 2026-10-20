import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKitchenRecipeApproval1765100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE kitchen_recipes
      ADD COLUMN expected_waste_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (expected_waste_percent >= 0 AND expected_waste_percent < 100),
      ADD COLUMN approval jsonb NOT NULL DEFAULT '{}'::jsonb`);
    // Preserve existing active recipes; record that they predate approval tracking.
    await q.query(
      `UPDATE kitchen_recipes SET approval='{"legacy":true}'::jsonb WHERE status IN ('ACTIVE','INACTIVE')`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    const pending = await q.query(
      `SELECT id FROM kitchen_recipes WHERE status IN ('PENDING_REVIEW','REVISION_REQUESTED') LIMIT 1`,
    );
    if (pending.length)
      throw new Error(
        'Resolve pending recipe reviews before reverting approval schema',
      );
    await q.query(
      'ALTER TABLE kitchen_recipes DROP COLUMN approval, DROP COLUMN expected_waste_percent',
    );
  }
}
