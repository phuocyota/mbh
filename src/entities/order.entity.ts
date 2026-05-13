import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { POSDevice } from './pos-device.entity';
import { Customer } from './customer.entity';
import { User } from './user.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @Column('varchar', { unique: true, name: 'order_code' })
  orderCode: string;

  @Column('uuid', { nullable: true, name: 'branch_id' })
  branchId: string;

  @Column('uuid', { nullable: true, name: 'pos_device_id' })
  posDeviceId: string;

  @Column('uuid', { nullable: true, name: 'customer_id' })
  customerId: string;

  @Column('uuid', { nullable: true, name: 'cashier_id' })
  cashierId: string;

  @Column('varchar', { nullable: true, name: 'order_type' })
  orderType: string; // DINE_IN, TAKEAWAY, PRE_ORDER

  @Column('varchar', { default: 'Pending' })
  status: string; // Pending, DONE, waiting

  @Column('numeric', { nullable: true, precision: 12, scale: 2 })
  subtotal: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'discount_amount',
  })
  discountAmount: number;

  @Column('numeric', { nullable: true, precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'paid_amount',
  })
  paidAmount: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'change_amount',
  })
  changeAmount: number;

  @Column('varchar', { default: 'UNPAID', name: 'payment_status' })
  paymentStatus: string; // UNPAID, PAID, PARTIAL, REFUNDED

  @Column('text', { nullable: true })
  note: string;

  @Column('timestamp', { nullable: true, name: 'paid_at' })
  paidAt: Date;

  @Column('timestamp', { nullable: true, name: 'completed_at' })
  completedAt: Date;

  @Column('timestamp', { nullable: true, name: 'cancelled_at' })
  cancelledAt: Date;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.orders)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => POSDevice, (device) => device.orders)
  @JoinColumn({ name: 'pos_device_id' })
  posDevice: POSDevice;

  @ManyToOne(() => Customer, (customer) => customer.orders)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @OneToMany('OrderItem', 'order', { cascade: true })
  items: any[];

  @OneToMany('Payment', 'order')
  payments: any[];

  @OneToMany('Refund', 'order')
  refunds: any[];

  @OneToMany('KitchenTicket', 'order')
  kitchenTickets: any[];
}
