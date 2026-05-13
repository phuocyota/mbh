import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateStudentCardsTable1704067202000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'student_cards',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'student_profile_id',
            type: 'uuid',
          },
          {
            name: 'card_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'ACTIVE'",
          },
          {
            name: 'issued_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expired_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'student_cards',
      new TableForeignKey({
        columnNames: ['student_profile_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'student_profiles',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'student_cards',
      new TableForeignKey({
        columnNames: ['card_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'cards',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('student_cards', true);
  }
}
