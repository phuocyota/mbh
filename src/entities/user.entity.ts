import { Entity, Column, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../common/sql/base.entity';
import { COMMON_STATUS, USER_ROLE } from '../common/constant/constant';

@Entity('users')
export class User extends BaseEntity {
  @Column('varchar', { name: 'full_name' })
  fullName: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { nullable: true, unique: true })
  email: string;

  @Exclude()
  @Column('varchar', { name: 'password_hash' })
  passwordHash: string;

  @Column('varchar', { default: USER_ROLE.STAFF })
  role: string; // ADMIN, MANAGER, CASHIER, KITCHEN, STAFF, STUDENT

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string; // ACTIVE, INACTIVE

  @Column('varchar', { nullable: true })
  avatar: string;

  @Column('varchar', { nullable: true })
  address: string;

  @Column('varchar', { nullable: true })
  province: string;

  @Column('varchar', { nullable: true })
  district: string;

  @Column('varchar', { nullable: true })
  birthday: string;

  @Column('text', { nullable: true })
  note: string;

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
