import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { COMMON_STATUS } from '../common/constant/constant';

@Entity('schools')
export class School extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  address: string;

  @Column('varchar', { nullable: true })
  phone: string;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;
}
