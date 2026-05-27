import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';

export type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_RECEIVED'
  | 'PAYMENT_DEDUCTED'
  | 'TOPUP_SUCCESS'
  | 'SYSTEM';

@Entity('notifications')
export class Notification extends BaseEntity {
  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @Column('text')
  message: string;

  @Column('varchar')
  type: NotificationType;

  @Column('numeric', { precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @Column('boolean', { default: false, name: 'is_read' })
  isRead: boolean;

  @Column('timestamp', { nullable: true, name: 'read_at' })
  readAt: Date | null;

  @Column('uuid', { nullable: true, name: 'ref_id' })
  refId: string | null;

  @Column('varchar', { nullable: true, name: 'ref_type' })
  refType: string | null;

  // Relations
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
