import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundService } from './refund.service';
import { RefundController } from './refund.controller';
import { Refund } from '../../entities/refund.entity';
import { RefundItemModule } from '../refund-item/refund-item.module';
import { OrderModule } from '../orders/order.module';
import { OrderItemModule } from '../order-item/order-item.module';
import { PaymentModule } from '../payment/payment.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refund]),
    RefundItemModule,
    OrderModule,
    OrderItemModule,
    PaymentModule,
    WalletModule,
  ],
  providers: [RefundService],
  controllers: [RefundController],
  exports: [RefundService],
})
export class RefundModule {}
