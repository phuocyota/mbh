import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MomoService } from './momo.service';
import { MomoController, MomoPaymentResultController } from './momo.controller';
import { OrderModule } from '../orders/order.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ConfigModule, OrderModule, WalletModule],
  controllers: [MomoController, MomoPaymentResultController],
  providers: [MomoService],
  exports: [MomoService],
})
export class MomoModule {}
