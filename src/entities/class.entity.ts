import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { School } from './school.entity';
import { StudentClass } from './student-class.entity';
import { COMMON_STATUS } from '../common/constant/constant';

@Entity('classes')
export class Class extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('uuid', { name: 'school_id' })
  schoolId: string;

  @Column('varchar', { nullable: true })
  grade: string;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  // Relations
  @ManyToOne(() => School, (school) => school.id)
  @JoinColumn({ name: 'school_id' })
  school: School;

  @OneToMany(() => StudentClass, (sc) => sc.class)
  students: StudentClass[];
}
