import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, StockReceiptDetail } from '../../entities';
import { FinanceModule } from '../finance/finance.module';
import { WarehouseVoucherController } from './warehouse-voucher.controller';
import { WarehouseVoucherService } from './warehouse-voucher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockReceiptDetail,
    ]),
    FinanceModule,
  ],
  controllers: [WarehouseVoucherController],
  providers: [WarehouseVoucherService],
  exports: [WarehouseVoucherService],
})
export class WarehouseVoucherModule {}
