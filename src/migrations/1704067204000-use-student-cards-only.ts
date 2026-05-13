import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseStudentCardsOnly1704067204000 implements MigrationInterface {
  name = 'UseStudentCardsOnly1704067204000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE student_cards
      ADD COLUMN IF NOT EXISTS card_uid varchar,
      ADD COLUMN IF NOT EXISTS card_number varchar
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.cards') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'student_cards'
              AND column_name = 'card_id'
          )
        THEN
          UPDATE student_cards sc
          SET
            card_uid = COALESCE(sc.card_uid, c.card_uid),
            card_number = COALESCE(sc.card_number, c.card_number)
          FROM cards c
          WHERE sc.card_id = c.id;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'student_cards'
            AND column_name = 'card_id'
        )
        THEN
          UPDATE student_cards
          SET card_uid = COALESCE(card_uid, card_id::text)
          WHERE card_uid IS NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE student_cards
      ALTER COLUMN card_uid SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_cards_card_uid
      ON student_cards(card_uid)
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        FOR constraint_name IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_name = 'student_cards'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'card_id'
        LOOP
          EXECUTE format('ALTER TABLE student_cards DROP CONSTRAINT %I', constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE student_cards
      DROP COLUMN IF EXISTS card_id
    `);

    await queryRunner.query('DROP TABLE IF EXISTS cards CASCADE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid NOT NULL,
        card_uid varchar UNIQUE NOT NULL,
        card_number varchar,
        status varchar DEFAULT 'ACTIVE',
        issued_at timestamp,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      INSERT INTO cards (
        customer_id,
        card_uid,
        card_number,
        status,
        issued_at,
        created_at,
        updated_at
      )
      SELECT
        sp.customer_id,
        sc.card_uid,
        sc.card_number,
        sc.status,
        sc.issued_at,
        sc.created_at,
        sc.updated_at
      FROM student_cards sc
      JOIN student_profiles sp ON sp.id = sc.student_profile_id
      ON CONFLICT (card_uid) DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE student_cards
      ADD COLUMN IF NOT EXISTS card_id uuid
    `);

    await queryRunner.query(`
      UPDATE student_cards sc
      SET card_id = c.id
      FROM cards c
      WHERE sc.card_uid = c.card_uid
    `);

    await queryRunner.query(`
      ALTER TABLE student_cards
      ALTER COLUMN card_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE student_cards
      ADD CONSTRAINT fk_student_cards_card
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    `);

    await queryRunner.query('DROP INDEX IF EXISTS idx_student_cards_card_uid');
    await queryRunner.query(`
      ALTER TABLE student_cards
      DROP COLUMN IF EXISTS card_uid,
      DROP COLUMN IF EXISTS card_number
    `);
  }
}
