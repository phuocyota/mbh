import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';

@Entity('student_profiles')
export class StudentProfile extends BaseEntity {
  @Column('uuid', { unique: true, name: 'customer_id' })
  customerId: string;

  @Column('uuid', { nullable: true, name: 'school_id' })
  schoolId: string;

  @Column('uuid', { nullable: true, name: 'class_id' })
  classId: string;

  @Column('varchar', { nullable: true, name: 'student_code' })
  studentCode: string;

  @Column('varchar', { nullable: true, name: 'parent_phone' })
  parentPhone: string;

  // Relations
  @OneToOne(() => Customer, (customer) => customer.studentProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
