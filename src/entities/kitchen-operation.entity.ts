import { Column, Entity, Index, VersionColumn } from 'typeorm';
import { LedgerBaseEntity } from '../common/sql/ledger-base.entity';

/** Persisted kitchen documents. Kind-specific validation is enforced by the service. */
@Entity('kitchen_operations')
@Index(['branchId', 'kind', 'date', 'shift'])
@Index(['branchId', 'requestId'], { unique: true })
export class KitchenOperation extends LedgerBaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('varchar') kind: string;
  @Column('date') date: string;
  @Column('varchar') shift: string;
  @Column('varchar', { default: 'DRAFT' }) status: string;
  @Column('uuid', { name: 'parent_id', nullable: true }) parentId:
    | string
    | null;
  @Column('uuid', { name: 'request_id', nullable: true }) requestId:
    | string
    | null;
  @Column('jsonb', { default: {} }) payload: Record<string, any>;
  @VersionColumn() version: number;
}
