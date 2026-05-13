import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { KioskController } from './kiosk.controller';
import {
  Order,
  OrderItem,
  Payment,
  Wallet,
  WalletTransaction,
  StudentCard,
  Customer,
  Product,
  KitchenTicket,
  KitchenTicketItem,
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
      StudentCard,
      Customer,
      Product,
      KitchenTicket,
      KitchenTicketItem,
    ]),
    CustomerModule,
  ],
  providers: [OrderService],
  controllers: [OrderController, KioskController],
  exports: [OrderService],
})
export class OrderModule {}
