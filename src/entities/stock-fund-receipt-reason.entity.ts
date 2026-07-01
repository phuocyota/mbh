import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('stock_fund_receipt_reason')
export class StockFundReceiptReason extends BaseEntity {
  @Column('varchar', { nullable: true })
  code: string;

  @Column('varchar')
  reason: string;

  @Column('text', { name: 'accounting_formula', nullable: true })
  accountingFormula: string;

  @Column('text', { nullable: true })
  note: string;

  @Column('varchar', { default: 'active' })
  status: string;
}
