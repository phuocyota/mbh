import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Stock } from './stock.entity';
import { Fund } from './fund.entity';

@Entity('stock_fund_receipt_reason')
export class StockFundReceiptReason extends BaseEntity {
  @Column('uuid', { name: 'stock_id', nullable: true })
  stockId: string;

  @Column('uuid', { name: 'fund_id', nullable: true })
  fundId: string;

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

  @ManyToOne(() => Stock, { nullable: true })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;

  @ManyToOne(() => Fund, { nullable: true })
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;
}
