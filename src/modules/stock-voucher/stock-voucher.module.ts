import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  Stock,
  StockItem,
} from '../../entities';
import { FinanceModule } from '../finance/finance.module';
import { StockVoucherController } from './stock-voucher.controller';
import { StockVoucherService } from './stock-voucher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockReceiptDetail,
      StockReceiptImport,
      StockReceiptExport,
      StockReceiptTransfer,
      Stock,
      StockItem,
    ]),
    FinanceModule,
  ],
  controllers: [StockVoucherController],
  providers: [StockVoucherService],
  exports: [StockVoucherService],
})
export class StockVoucherModule {}
