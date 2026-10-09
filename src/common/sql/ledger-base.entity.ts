import {
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** New ledgers store event instants with timezone; legacy tables retain their schema. */
export abstract class LedgerBaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', nullable: true }) createdBy?: string;
  @Column({ name: 'updated_by', nullable: true }) updatedBy?: string;
}
