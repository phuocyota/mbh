import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { StudentProfile } from './student-profile.entity';

@Entity('student_cards')
export class StudentCard extends BaseEntity {
  @Column('uuid', { name: 'student_profile_id' })
  studentProfileId: string;

  @Column('varchar', { unique: true, name: 'card_uid' })
  cardUid: string;

  @Column('varchar', { nullable: true, name: 'card_number' })
  cardNumber: string;

  @Column('varchar', { default: 'ACTIVE' })
  status: string;

  @Column('timestamp', { nullable: true, name: 'issued_at' })
  issuedAt: Date;

  @Column('timestamp', { nullable: true, name: 'expired_at' })
  expiredAt: Date;

  @ManyToOne(() => StudentProfile, (studentProfile) => studentProfile.studentCards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;
}
