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
} from 'src/entities';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Payment,
      Wallet,
      WalletTransaction,
      Customer,
    ]),
    CustomerModule,
  ],
  providers: [OrderService, OrderNumberService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
