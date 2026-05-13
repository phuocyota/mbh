import { Entity, Column, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';
import { StudentCard } from './student-card.entity';

@Entity('student_profiles')
export class StudentProfile extends BaseEntity {
  @Column('uuid', { unique: true, name: 'customer_id' })
  customerId: string;

  @Column('uuid', { nullable: true, name: 'class_id' })
  classId: string;

  @Column('varchar', { nullable: true, name: 'student_code' })
  studentCode: string;

  @Column('varchar', { nullable: true, name: 'full_name' })
  fullName: string;

  // Relations
  @OneToOne(() => Customer, (customer) => customer.studentProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => StudentCard, (studentCard) => studentCard.studentProfile)
  studentCards: StudentCard[];
}
