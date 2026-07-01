import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { StockReceiptDetail } from './stock-receipt-detail.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_receipt_export')
export class StockReceiptExport extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('uuid', { name: 'to_id', nullable: true })
  toId: string;

  @Column('varchar', { name: 'to_type', nullable: true })
  toType: string; // customer, stock, etc.

  @Column('uuid', { name: 'reference_id', nullable: true })
  referenceId: string;

  @Column('varchar', { name: 'reference_type', nullable: true })
  referenceType: string; // order, etc.

  @Column('varchar', { name: 'reason_code', nullable: true })
  reasonCode: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('varchar', { default: 'COMPLETED' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany(() => StockReceiptDetail, (detail) => detail.exportReceipt, { cascade: true })
  details: StockReceiptDetail[];
}
