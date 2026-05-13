import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('inventory_items')
export class InventoryItem extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('varchar')
  unit: string; // kg, g, chai, hộp

  @Column('varchar', { default: 'ACTIVE' })
  status: string;
}
