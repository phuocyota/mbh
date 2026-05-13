import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { StudentProfile } from './student-profile.entity';
import { Card } from './card.entity';

@Entity('student_cards')
export class StudentCard extends BaseEntity {
  @Column('uuid', { name: 'student_profile_id' })
  studentProfileId: string;

  @Column('uuid', { name: 'card_id' })
  cardId: string;

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

  @ManyToOne(() => Card)
  @JoinColumn({ name: 'card_id' })
  card: Card;
}
