import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { StockReceiptImport } from './stock-receipt-import.entity';
import { StockReceiptExport } from './stock-receipt-export.entity';
import { StockReceiptTransfer } from './stock-receipt-transfer.entity';

@Entity('stock_receipt_detail')
export class StockReceiptDetail extends BaseEntity {
  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', { precision: 12, scale: 2 })
  quantity: number;

  @Column('varchar', { name: 'receipt_type' })
  receiptType: string; // IMPORT, EXPORT, TRANSFER

  @Column('uuid', { name: 'from_id', nullable: true })
  fromId?: string | null;

  @Column('uuid', { name: 'to_id', nullable: true })
  toId?: string | null;

  @Column('varchar', { name: 'from_type' })
  fromType: string; // STOCK, VENDOR

  @Column('varchar', { name: 'to_type' })
  toType: string; // STOCK, VENDOR

  @Column('uuid', { name: 'import_id', nullable: true })
  importId: string;

  @Column('uuid', { name: 'export_id', nullable: true })
  exportId: string;

  @Column('uuid', { name: 'transfer_id', nullable: true })
  transferId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => StockReceiptImport, (importReceipt) => importReceipt.details, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'import_id' })
  importReceipt: StockReceiptImport;

  @ManyToOne(() => StockReceiptExport, (exportReceipt) => exportReceipt.details, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'export_id' })
  exportReceipt: StockReceiptExport;

  @ManyToOne(() => StockReceiptTransfer, (transferReceipt) => transferReceipt.details, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'transfer_id' })
  transferReceipt: StockReceiptTransfer;
}
