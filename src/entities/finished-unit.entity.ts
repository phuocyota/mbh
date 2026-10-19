import {
  Check,
  Column,
  Entity,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LedgerBaseEntity } from '../common/sql/ledger-base.entity';
import { Branch } from './branch.entity';
import { KitchenProductionBatch } from './kitchen.entity';
import { Product } from './product.entity';

/** One immutable identity per physical portion, never one shared QR per batch. */
@Entity('finished_units')
@Unique('UQ_finished_unit_batch_serial', ['batchId', 'serial'])
@Index('IDX_finished_units_branch_batch', ['branchId', 'batchId'])
@Check('CHK_finished_unit_serial', 'serial > 0')
export class FinishedUnit extends LedgerBaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('uuid', { name: 'batch_id' }) batchId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('int') serial: number;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt: Date;
  @ManyToOne(() => Branch) @JoinColumn({ name: 'branch_id' }) branch: Branch;
  @ManyToOne(() => KitchenProductionBatch)
  @JoinColumn({ name: 'batch_id' })
  batch: KitchenProductionBatch;
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
