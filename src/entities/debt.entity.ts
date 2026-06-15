import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Supplier } from './supplier.entity';

@Entity('debts')
export class Debt extends BaseEntity {
  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar')
  type: string;

  @Column('numeric', { precision: 15, scale: 2 })
  amount: number;

  @Column('numeric', { precision: 15, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @Column('varchar', { name: 'ref_type', nullable: true })
  refType: string;

  @Column('uuid', { name: 'ref_id', nullable: true })
  refId: string;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
