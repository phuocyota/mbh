import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillProductCode1762200000000 implements MigrationInterface {
  name = 'BackfillProductCode1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH max_codes AS (
        SELECT
          branch_id,
          COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0) AS max_code
        FROM "products"
        WHERE code ~ '^SP[0-9]+$'
        GROUP BY branch_id
      ),
      missing_codes AS (
        SELECT
          p.id,
          'SP' || LPAD(
            (
              COALESCE(mc.max_code, 0) +
              ROW_NUMBER() OVER (
                PARTITION BY p.branch_id
                ORDER BY p.created_at, p.id
              )
            )::text,
            6,
            '0'
          ) AS generated_code
        FROM "products" p
        LEFT JOIN max_codes mc
          ON (
            mc.branch_id = p.branch_id
            OR (mc.branch_id IS NULL AND p.branch_id IS NULL)
          )
        WHERE p.code IS NULL OR TRIM(p.code) = ''
      )
      UPDATE "products" p
      SET code = missing_codes.generated_code
      FROM missing_codes
      WHERE p.id = missing_codes.id
    `);
  }

  public async down(): Promise<void> {
    return;
  }
}
