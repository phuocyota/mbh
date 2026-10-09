import { Column, Entity, Index, Unique } from 'typeorm';
import { LedgerBaseEntity } from '../common/sql/ledger-base.entity';

@Entity('stock_lots')
@Unique(['stockId', 'productId', 'lotCode'])
@Index(['stockId', 'productId'])
export class StockLot extends LedgerBaseEntity {
  @Column('uuid', { name: 'stock_id' }) stockId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('varchar', { name: 'lot_code' }) lotCode: string;
  @Column('date', { name: 'manufactured_at', nullable: true }) manufacturedAt:
    | string
    | null;
  @Column('date', { name: 'expires_at', nullable: true }) expiresAt:
    | string
    | null;
  @Column('numeric', { precision: 18, scale: 4, default: 0 }) quantity: number;
}

@Entity('stock_movements')
@Index(['referenceId', 'productId', 'lotId'])
export class StockMovement extends LedgerBaseEntity {
  @Column('uuid', { name: 'stock_id' }) stockId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('uuid', { name: 'lot_id', nullable: true }) lotId: string | null;
  @Column('uuid', { name: 'reference_id' }) referenceId: string;
  @Column('numeric', { precision: 18, scale: 4 }) quantity: number;
}

@Entity('stock_requests')
@Unique(['branchId', 'requestId'])
export class StockRequest extends LedgerBaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('uuid', { name: 'request_id' }) requestId: string;
  @Column('jsonb') result: any;
  @Column('varchar', { name: 'payload_hash' }) payloadHash: string;
}
