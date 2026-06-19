import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { StockReceiptDetail } from './stock-receipt-detail.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_receipt_transfer')
export class StockReceiptTransfer extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('uuid', { name: 'transfer_id' })
  transferId: string;

  @Column('uuid', { name: 'from_branch_id', default: DEFAULT_BRANCH_ID })
  fromBranchId: string;

  @Column('uuid', { name: 'to_branch_id', default: DEFAULT_BRANCH_ID })
  toBranchId: string;

  @Column('varchar', { default: 'DRAFT' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('timestamp', { name: 'received_at', nullable: true })
  receivedAt: Date;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'from_branch_id' })
  fromBranch: Branch;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'to_branch_id' })
  toBranch: Branch;

  @OneToMany(() => StockReceiptDetail, (detail) => detail.transferReceipt, { cascade: true })
  details: StockReceiptDetail[];
}
