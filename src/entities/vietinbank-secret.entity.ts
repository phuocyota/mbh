import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('vietinbank_secrets')
export class VietinBankSecret extends BaseEntity {
  @Column('varchar', { unique: true, length: 500 })
  ref: string;

  @Column('text')
  ciphertext: string;

  @Column('varchar', { length: 64 })
  iv: string;

  @Column('varchar', { name: 'auth_tag', length: 64 })
  authTag: string;

  @Column('int', { default: 1 })
  version: number;
}
