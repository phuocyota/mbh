import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';

@Entity('suppliers')
export class Supplier extends BaseEntity {
  @Column('uuid', { name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column('varchar', { unique: true, name: 'code' })
  code: string;

  @Column('varchar', { name: 'name' })
  name: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { nullable: true })
  email: string;

  @Column('varchar', { nullable: true, name: 'tax_code' })
  taxCode: string;

  @Column('varchar', { nullable: true, name: 'company_name' })
  companyName: string;

  @Column('varchar', { nullable: true })
  address: string;

  @Column('varchar', { nullable: true })
  province: string;

  @Column('varchar', { nullable: true })
  district: string;

  @Column('varchar', { nullable: true })
  ward: string;

  @Column('varchar', { nullable: true, name: 'id_card' })
  idCard: string;

  @Column('varchar', { nullable: true })
  group: string;

  @Column('text', { nullable: true })
  note: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  debt: number;

  @Column('numeric', {
    precision: 15,
    scale: 2,
    default: 0,
    name: 'total_purchase',
  })
  totalPurchase: number;

  @Column('varchar', { default: 'active' })
  status: string; // active, inactive

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;
}
