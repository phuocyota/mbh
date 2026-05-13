import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column('varchar', { name: 'full_name' })
  fullName: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { nullable: true, unique: true })
  email: string;

  @Column('varchar', { name: 'password_hash' })
  passwordHash: string;

  @Column('varchar', { default: 'STAFF' })
  role: string; // ADMIN, MANAGER, CASHIER, KITCHEN, STAFF

  @Column('varchar', { default: 'ACTIVE' })
  status: string; // ACTIVE, INACTIVE

  // Relations
  @OneToMany('Order', 'cashier')
  orders: any[];

  @OneToMany('WalletTransaction', 'createdBy')
  walletTransactions: any[];

  @OneToMany('StockTransaction', 'createdBy')
  stockTransactions: any[];

  @OneToMany('Refund', 'createdBy')
  refunds: any[];

  @OneToMany('Shift', 'cashier')
  shifts: any[];

  @OneToMany('Payment', 'createdBy')
  payments: any[];
}
