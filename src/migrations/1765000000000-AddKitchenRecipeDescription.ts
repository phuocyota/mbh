import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKitchenRecipeDescription1765000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE kitchen_recipes ADD COLUMN description varchar(500) NULL',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE kitchen_recipes DROP COLUMN description');
  }
}
