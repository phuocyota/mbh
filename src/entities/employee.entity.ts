import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';

@Entity('employees')
export class Employee extends BaseEntity {
  @Column('varchar', { unique: true, name: 'code' })
  code: string;

  @Column('varchar', { unique: true, nullable: true, name: 'timekeeping_code' })
  timekeepingCode: string;

  @Column('varchar', { name: 'full_name' })
  fullName: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { nullable: true })
  cccd: string;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  debt: number;

  @Column('uuid', { nullable: true, name: 'branch_id' })
  branchId: string;

  @Column('text', { nullable: true })
  note: string;

  @Column('varchar', { default: 'working' })
  status: string; // working, quit

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;
}
