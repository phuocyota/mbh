import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCustomerSupplierDebtOffsetReason1762400000000
  implements MigrationInterface
{
  name = 'SeedCustomerSupplierDebtOffsetReason1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        UPDATE "stock_fund_receipt_reason"
        SET
          "reason" = 'Bu tru cong no khach hang va nha cung cap',
          "accounting_formula" = '{331:-,131:+}',
          "note" = 'Bu tru cong no khi mot doi tuong vua la khach hang vua la nha cung cap: No 331, Co 131.',
          "is_debt" = true,
          "status" = 'active',
          "updated_at" = now()
        WHERE "code" = 'BT_CN_KH_NCC';

        IF NOT FOUND THEN
          INSERT INTO "stock_fund_receipt_reason" (
            "id",
            "created_at",
            "updated_at",
            "code",
            "reason",
            "accounting_formula",
            "note",
            "is_debt",
            "status"
          )
          VALUES (
            uuid_generate_v4(),
            now(),
            now(),
            'BT_CN_KH_NCC',
            'Bu tru cong no khach hang va nha cung cap',
            '{331:-,131:+}',
            'Bu tru cong no khi mot doi tuong vua la khach hang vua la nha cung cap: No 331, Co 131.',
            true,
            'active'
          );
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "stock_fund_receipt_reason"
      WHERE "code" = 'BT_CN_KH_NCC'
    `);
  }
}
