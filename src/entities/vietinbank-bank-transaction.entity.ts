import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { VietinBankTopupRequest } from './vietinbank-topup-request.entity';

@Entity('vietinbank_bank_transactions')
@Index('IDX_vietinbank_bank_transaction_topup', ['topupRequestId'])
export class VietinBankBankTransaction extends BaseEntity {
  @Column('varchar', { unique: true, name: 'trans_id', length: 128 })
  transId: string;

  @Column('varchar', { name: 'bank_trans_id', length: 128 })
  bankTransId: string;

  @Column('uuid', { name: 'topup_request_id' })
  topupRequestId: string;

  @Column('varchar', { name: 'payment_code', length: 32 })
  paymentCode: string;

  @Column('varchar', { nullable: true, name: 'send_account_id', length: 128 })
  sendAccountId: string | null;

  @Column('varchar', { name: 'recv_account_id', length: 128 })
  recvAccountId: string;

  @Column('numeric', { precision: 12, scale: 2 })
  amount: number;

  @Column('varchar', { length: 3 })
  currency: string;

  @Column('text', { nullable: true })
  remark: string | null;

  @Column('varchar', { name: 'trans_time', length: 32 })
  transTime: string;

  @Column('varchar', { length: 32 })
  status: string;

  @Column('numeric', { precision: 12, scale: 2, name: 'balance_before' })
  balanceBefore: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @Column('jsonb', { name: 'raw_request' })
  rawRequest: Record<string, unknown>;

  @Column('timestamptz', { name: 'received_at' })
  receivedAt: Date;

  @ManyToOne(() => VietinBankTopupRequest)
  @JoinColumn({ name: 'topup_request_id' })
  topupRequest: VietinBankTopupRequest;
}
