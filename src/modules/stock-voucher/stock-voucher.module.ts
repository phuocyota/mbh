import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  Stock,
  StockItem,
  StockFundReceiptReason,
  MoneyVoucher,
  FundReceiptPaid,
  FundReceiptReceived,
} from '../../entities';
import { FinanceModule } from '../finance/finance.module';
import { SupplierModule } from '../supplier/supplier.module';
import { StockModule } from '../stock/stock.module';
import { StockVoucherController } from './stock-voucher.controller';
import { StockVoucherService } from './stock-voucher.service';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockReceiptDetail,
      StockReceiptImport,
      StockReceiptExport,
      StockReceiptTransfer,
      Stock,
      StockItem,
      StockFundReceiptReason,
      MoneyVoucher,
      FundReceiptPaid,
      FundReceiptReceived,
    ]),
    FinanceModule,
    SupplierModule,
    StockModule,
    SocketModule,
  ],
  controllers: [StockVoucherController],
  providers: [StockVoucherService],
  exports: [StockVoucherService],
})
export class StockVoucherModule {}
