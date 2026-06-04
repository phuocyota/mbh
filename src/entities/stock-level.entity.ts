import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { InventoryItem } from './inventory-item.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_levels')
export class StockLevel extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('uuid', { name: 'inventory_item_id' })
  inventoryItemId: string;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  quantity: number;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.stockLevels)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;
}
