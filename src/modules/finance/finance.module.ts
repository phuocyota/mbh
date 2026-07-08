import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Debt,
  Fund,
  FundTransaction,
  MoneyVoucher,
  Supplier,
  FundReceiptReceived,
  FundReceiptPaid,
  FundReceiptTransfer,
  FundDetail,
  StockFundReceiptReason,
} from '../../entities';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Fund,
      FundTransaction,
      MoneyVoucher,
      Debt,
      Supplier,
      FundReceiptReceived,
      FundReceiptPaid,
      FundReceiptTransfer,
      FundDetail,
      StockFundReceiptReason,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
