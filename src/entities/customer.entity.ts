import { Entity, Column, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Card } from './card.entity';
import { Order } from './order.entity';
import { Wallet } from './wallet.entity';
import { StudentProfile } from './student-profile.entity';
import { StudentClass } from './student-class.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @Column('varchar', { unique: true, name: 'customer_code' })
  customerCode: string;

  @Column('varchar', { name: 'full_name' })
  fullName: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { default: 'GUEST' })
  type: string; // STUDENT, TEACHER, GUEST

  @Column('varchar', { default: 'ACTIVE' })
  status: string;

  @Column('uuid', { nullable: true, name: 'user_id', unique: true })
  userId: string;

  // Relations
  @OneToMany(() => Card, (card) => card.customer)
  cards: Card[];

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToOne(() => Wallet, (wallet) => wallet.customer)
  wallet: Wallet;

  @OneToOne(() => StudentProfile, (profile) => profile.customer)
  studentProfile: StudentProfile;

  @OneToMany(() => StudentClass, (sc) => sc.student)
  classes: StudentClass[];
}
