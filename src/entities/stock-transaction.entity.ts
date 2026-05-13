import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';

@Entity('stock_transactions')
export class StockTransaction extends BaseEntity {
  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'inventory_item_id' })
  inventoryItemId: string;

  @Column('varchar')
  type: string; // IMPORT, EXPORT, SALE, ADJUSTMENT, WASTE

  @Column('numeric', { precision: 12, scale: 2 })
  quantity: number;

  @Column('varchar', { name: 'ref_type' })
  refType: string; // ORDER, IMPORT_NOTE, MANUAL

  @Column('uuid', { nullable: true, name: 'ref_id' })
  refId: string;

  @Column('text', { nullable: true })
  note: string;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.stockTransactions)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne('InventoryItem')
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: any;

  @ManyToOne('User', 'stockTransactions')
  @JoinColumn({ name: 'created_by' })
  createdByUser: any;
}
