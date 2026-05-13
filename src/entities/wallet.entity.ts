import { Entity, Column, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';
import { WalletTransaction } from './wallet-transaction.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Column('uuid', { unique: true, name: 'customer_id' })
  customerId: string;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column('varchar', { default: 'ACTIVE' })
  status: string;

  // Relations
  @OneToOne(() => Customer, (customer) => customer.wallet)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => WalletTransaction, (wt) => wt.wallet)
  transactions: WalletTransaction[];
}
