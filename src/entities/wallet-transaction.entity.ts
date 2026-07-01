import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Wallet } from './wallet.entity';
import { Customer } from './customer.entity';
import { User } from './user.entity';

@Entity('wallet_transactions')
export class WalletTransaction extends BaseEntity {
  @Column('uuid', { name: 'wallet_id' })
  walletId: string;

  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @Column('varchar')
  type: string; // TOPUP, PAYMENT, REFUND, ADJUSTMENT

  @Column('numeric', { precision: 12, scale: 2 })
  amount: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'balance_before' })
  balanceBefore: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @Column('varchar', { name: 'ref_type' })
  refType: string; // ORDER, REFUND, MANUAL

  @Column('uuid', { nullable: true, name: 'ref_id' })
  refId: string;

  @Column('varchar', { nullable: true, name: 'reason_code' })
  reasonCode: string;

  @Column('text', { nullable: true })
  note: string;

  // Relations
  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, (user) => user.walletTransactions)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;
}
