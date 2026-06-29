import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MomoService } from './momo.service';
import { MomoController } from './momo.controller';
import { OrderModule } from '../orders/order.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ConfigModule, OrderModule, WalletModule],
  controllers: [MomoController],
  providers: [MomoService],
  exports: [MomoService],
})
export class MomoModule {}
