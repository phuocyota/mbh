import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AlignStudentProfilesSchema1704067203000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('student_profiles');

    if (table?.findColumnByName('school_id')) {
      await queryRunner.dropColumn('student_profiles', 'school_id');
    }

    if (table?.findColumnByName('parent_phone')) {
      await queryRunner.dropColumn('student_profiles', 'parent_phone');
    }

    if (!table?.findColumnByName('full_name')) {
      await queryRunner.addColumn(
        'student_profiles',
        new TableColumn({
          name: 'full_name',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('student_profiles');

    if (table?.findColumnByName('full_name')) {
      await queryRunner.dropColumn('student_profiles', 'full_name');
    }

    if (!table?.findColumnByName('school_id')) {
      await queryRunner.addColumn(
        'student_profiles',
        new TableColumn({
          name: 'school_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    if (!table?.findColumnByName('parent_phone')) {
      await queryRunner.addColumn(
        'student_profiles',
        new TableColumn({
          name: 'parent_phone',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
  }
}
