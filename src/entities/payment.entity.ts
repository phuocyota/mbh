import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Order } from './order.entity';
import { User } from './user.entity';

@Entity('payments')
export class Payment extends BaseEntity {
  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('varchar')
  method: string; // CASH, CARD, WALLET, BANK_TRANSFER, QR

  @Column('numeric', { precision: 12, scale: 2 })
  amount: number;

  @Column('varchar', { default: 'PENDING' })
  status: string; // PENDING, SUCCESS, FAILED, REFUNDED

  @Column('varchar', { nullable: true, name: 'transaction_code' })
  transactionCode: string;

  @Column('uuid', { nullable: true, name: 'paid_by_customer_id' })
  paidByCustomerId: string;

  // Relations
  @ManyToOne(() => Order, (order) => order.payments)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => User, (user) => user.payments)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;
}
