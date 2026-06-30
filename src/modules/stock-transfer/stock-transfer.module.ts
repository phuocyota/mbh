import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, StockReceiptTransfer, StockReceiptDetail, Stock, StockItem } from '../../entities';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';
import { StockVoucherModule } from '../stock-voucher/stock-voucher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockReceiptTransfer,
      StockReceiptDetail,
      Stock,
      StockItem,
    ]),
    StockVoucherModule,
  ],
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
