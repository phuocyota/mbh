import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';
import { Class } from './class.entity';

@Entity('student_classes')
export class StudentClass extends BaseEntity {
  @Column('uuid', { name: 'student_id' })
  studentId: string;

  @Column('uuid', { name: 'class_id' })
  classId: string;

  @Column('varchar', { nullable: true })
  year: string; // Năm học, ví dụ: 2024-2025

  @Column('varchar', { default: 'ACTIVE' })
  status: string; // ACTIVE, COMPLETED, TRANSFERRED

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.classes)
  @JoinColumn({ name: 'student_id' })
  student: Customer;

  @ManyToOne(() => Class, (cls) => cls.students)
  @JoinColumn({ name: 'class_id' })
  class: Class;
}
