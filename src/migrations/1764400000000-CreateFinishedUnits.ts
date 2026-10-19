import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinishedUnits1764400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE finished_units (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      branch_id uuid NOT NULL REFERENCES branches(id),
      batch_id uuid NOT NULL REFERENCES kitchen_production_batches(id),
      product_id uuid NOT NULL REFERENCES products(id),
      serial int NOT NULL CONSTRAINT "CHK_finished_unit_serial" CHECK (serial > 0),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      created_by varchar, updated_by varchar,
      CONSTRAINT "UQ_finished_unit_batch_serial" UNIQUE (batch_id, serial)
    )`);
    await q.query(
      'CREATE INDEX "IDX_finished_units_branch_batch" ON finished_units(branch_id,batch_id)',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE finished_units');
  }
}
