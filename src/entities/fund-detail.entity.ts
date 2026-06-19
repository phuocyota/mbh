import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Fund } from './fund.entity';
import { FundReceiptReceived } from './fund-receipt-received.entity';
import { FundReceiptPaid } from './fund-receipt-paid.entity';
import { FundReceiptTransfer } from './fund-receipt-transfer.entity';

@Entity('fund_detail')
export class FundDetail extends BaseEntity {
  @Column('numeric', { precision: 15, scale: 2 })
  amount: number;

  @Column('varchar')
  type: string; // RECEIVED, PAID, TRANSFER

  @Column('varchar')
  category: string; // classification, e.g. STOCK_IMPORT, ELECTRICITY

  @Column('uuid', { name: 'fund_id' })
  fundId: string;

  @Column('uuid', { name: 'received_id', nullable: true })
  receivedId: string;

  @Column('uuid', { name: 'paid_id', nullable: true })
  paidId: string;

  @Column('uuid', { name: 'transfer_id', nullable: true })
  transferId: string;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;

  @ManyToOne(() => FundReceiptReceived, (receipt) => receipt.details, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'received_id' })
  receivedReceipt: FundReceiptReceived;

  @ManyToOne(() => FundReceiptPaid, (receipt) => receipt.details, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'paid_id' })
  paidReceipt: FundReceiptPaid;

  @ManyToOne(() => FundReceiptTransfer, (receipt) => receipt.details, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'transfer_id' })
  transferReceipt: FundReceiptTransfer;
}
