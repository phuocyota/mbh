import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundService } from './refund.service';
import { RefundController } from './refund.controller';
import { Refund } from '../../entities/refund.entity';
import { RefundItem } from '../../entities/refund-item.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Payment } from '../../entities/payment.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Refund,
      RefundItem,
      Order,
      OrderItem,
      Payment,
      Wallet,
      WalletTransaction,
    ]),
  ],
  providers: [RefundService],
  controllers: [RefundController],
  exports: [RefundService],
})
export class RefundModule {}
