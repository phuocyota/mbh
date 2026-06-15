import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLevel, StockTransaction, WarehouseVoucher, WarehouseVoucherItem } from '../../entities';
import { FinanceModule } from '../finance/finance.module';
import { WarehouseVoucherController } from './warehouse-voucher.controller';
import { WarehouseVoucherService } from './warehouse-voucher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseVoucher,
      WarehouseVoucherItem,
      StockLevel,
      StockTransaction,
    ]),
    FinanceModule,
  ],
  controllers: [WarehouseVoucherController],
  providers: [WarehouseVoucherService],
  exports: [WarehouseVoucherService],
})
export class WarehouseVoucherModule {}
