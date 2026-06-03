import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { POSDevice } from './pos-device.entity';
import { Customer } from './customer.entity';
import { User } from './user.entity';
import {
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
} from '../common/constant/constant';

@Entity('orders')
export class Order extends BaseEntity {
  @Column('varchar', { unique: true, name: 'order_code' })
  orderCode: string;

  @Column('integer', { nullable: true, name: 'order_number', unique: true })
  orderNumber: number;

  @Column('uuid', { nullable: true, name: 'branch_id' })
  branchId: string;

  @Column('uuid', { nullable: true, name: 'pos_device_id' })
  posDeviceId: string;

  @Column('uuid', { nullable: true, name: 'customer_id' })
  customerId: string;

  @Column('uuid', { nullable: true, name: 'cashier_id' })
  cashierId: string;

  @Column('uuid', { nullable: true, name: 'coupon_id' })
  couponId: string;

  @Column('varchar', { nullable: true, name: 'order_type' })
  orderType: string; // DINE_IN, TAKEAWAY, PRE_ORDER

  @Column('int', { default: ORDER_STATUS.PENDING })
  status: number; // 0=CANCELLED, 1=PREPARING, 2=PENDING, 3=PENDING_PAYMENT, 4=READY_TO_PICKUP, 5=DONE

  @Column('numeric', { nullable: true, precision: 12, scale: 2 })
  subtotal: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'discount_amount',
  })
  discountAmount: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'coupon_discount',
  })
  couponDiscount: number;

  @Column('numeric', {
    nullable: true,
    precision: 12,
    scale: 2,
    name: 'total_amount',
  })
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

  @Column('varchar', {
    default: ORDER_PAYMENT_STATUS.UNPAID,
    name: 'payment_status',
  })
  paymentStatus: string; // UNPAID, PAID, PARTIAL, REFUNDED

  @Column('varchar', { nullable: true, name: 'payment_method' })
  paymentMethod: string; // CASH, WALLET, CARD, BANK_TRANSFER, QR

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

  @ManyToOne('Coupon', 'orders')
  @JoinColumn({ name: 'coupon_id' })
  coupon: any;

  @OneToMany('OrderItem', 'order', { cascade: true })
  items: any[];

  @OneToMany('Payment', 'order')
  payments: any[];

  @OneToMany('Refund', 'order')
  refunds: any[];

  @OneToMany('KitchenTicket', 'order')
  kitchenTickets: any[];
}
