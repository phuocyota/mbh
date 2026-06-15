import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderNumberService } from './order-number.service';
import { Order } from 'src/entities';
import { CustomerModule } from '../customer/customer.module';
import { CouponModule } from '../coupon/coupon.module';
import { OrderItemModule } from '../order-item/order-item.module';
import { PaymentModule } from '../payment/payment.module';
import { WalletModule } from '../wallet/wallet.module';
import { SocketModule } from '../socket/socket.module';
import { WarehouseVoucherModule } from '../warehouse-voucher/warehouse-voucher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    OrderItemModule,
    PaymentModule,
    WalletModule,
    CustomerModule,
    CouponModule,
    SocketModule,
    WarehouseVoucherModule,
  ],
  providers: [OrderService, OrderNumberService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
