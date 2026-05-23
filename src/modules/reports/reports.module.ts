import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { OrderModule } from '../orders/order.module';
import { OrderItemModule } from '../order-item/order-item.module';
import { PaymentModule } from '../payment/payment.module';
import { ShiftModule } from '../shift/shift.module';
import { CashMovementModule } from '../cash-movement/cash-movement.module';
import { StockLevelModule } from '../stock-level/stock-level.module';

@Module({
  imports: [
    OrderModule,
    OrderItemModule,
    PaymentModule,
    ShiftModule,
    CashMovementModule,
    StockLevelModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
