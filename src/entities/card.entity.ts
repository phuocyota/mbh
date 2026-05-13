import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';

@Entity('cards')
export class Card extends BaseEntity {
  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @Column('varchar', { unique: true, name: 'card_uid' })
  cardUid: string;

  @Column('varchar', { name: 'card_number' })
  cardNumber: string;

  @Column('varchar', { default: 'ACTIVE' })
  status: string; // ACTIVE, LOST, BLOCKED

  @Column('timestamp', { nullable: true, name: 'issued_at' })
  issuedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.cards)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
