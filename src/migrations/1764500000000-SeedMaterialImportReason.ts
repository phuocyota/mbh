import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMaterialImportReason1764500000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Material purchases on credit debit 152 and credit 331. Paid imports retain their configured fund formula.
    await q.query(`
      DO $$
      DECLARE
        debt_mode boolean;
        formula text;
      BEGIN
        UPDATE stock_fund_receipt_reason
        SET accounting_formula = '{152:-,331:+}', updated_at = now()
        WHERE code = 'NHNNL' AND is_debt = true;

        FOREACH debt_mode IN ARRAY ARRAY[false, true] LOOP
          IF NOT EXISTS (
            SELECT 1 FROM stock_fund_receipt_reason
            WHERE code = 'NHNNL' AND is_debt = debt_mode
          ) THEN
            IF debt_mode THEN
              formula := '{152:-,331:+}';
            ELSE
              SELECT accounting_formula INTO formula
              FROM stock_fund_receipt_reason
              WHERE code = 'NHNCC' AND is_debt = debt_mode AND status = 'active'
                AND NULLIF(trim(accounting_formula), '') IS NOT NULL
              ORDER BY updated_at DESC, id LIMIT 1;

              IF formula IS NULL THEN
                RAISE EXCEPTION 'Missing active NHNCC accounting formula for is_debt=%', debt_mode;
              END IF;
            END IF;

            INSERT INTO stock_fund_receipt_reason (
              id, created_at, updated_at, code, reason, accounting_formula, note, is_debt, status
            ) VALUES (
              uuid_generate_v4(), now(), now(), 'NHNNL', 'Nhập nguyên, nhiên liệu', formula,
              'Nhập nguyên liệu/nhiên liệu từ nhà cung cấp theo lô.', debt_mode, 'active'
            );
          END IF;
        END LOOP;
      END $$;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM stock_fund_receipt_reason WHERE code = 'NHNNL'`);
  }
}
