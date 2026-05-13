import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderNumberService } from './order-number.service';
import {
  Order,
  OrderItem,
  Payment,
  Wallet,
  WalletTransaction,
  Customer,
  Coupon,
} from 'src/entities';
import { CustomerModule } from '../customer/customer.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Payment,
      Wallet,
      WalletTransaction,
      Customer,
      Coupon,
    ]),
    CustomerModule,
    CouponModule,
  ],
  providers: [OrderService, OrderNumberService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
