import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { OrderModule } from '../orders/order.module';
import { OrderItemModule } from '../order-item/order-item.module';
import { PaymentModule } from '../payment/payment.module';
import { ShiftModule } from '../shift/shift.module';
import { CashMovementModule } from '../cash-movement/cash-movement.module';
import { CustomerMealItem, Product, StockItem } from '../../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, StockItem, CustomerMealItem]),
    OrderModule,
    OrderItemModule,
    PaymentModule,
    ShiftModule,
    CashMovementModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
