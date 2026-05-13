import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';

@Entity('pos_devices')
export class POSDevice extends BaseEntity {
  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { name: 'device_code' })
  deviceCode: string;

  @Column('varchar', { name: 'device_name' })
  deviceName: string;

  @Column('varchar', { name: 'device_type' })
  deviceType: string; // DESKTOP_POS, HANDHELD, TABLET

  @Column('varchar', { default: 'ACTIVE' })
  status: string; // ACTIVE, INACTIVE

  @Column('timestamp', { nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.posDevices)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany('Order', 'posDevice')
  orders: any[];

  @OneToMany('Shift', 'posDevice')
  shifts: any[];
}
