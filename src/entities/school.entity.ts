import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('schools')
export class School extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  address: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { default: 'ACTIVE' })
  status: string;
}
