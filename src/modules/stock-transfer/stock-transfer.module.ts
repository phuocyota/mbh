import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Product,
  StockTransaction,
  StockTransfer,
  StockTransferItem,
} from '../../entities';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockTransaction,
      StockTransfer,
      StockTransferItem,
    ]),
  ],
  providers: [StockTransferService],
  controllers: [StockTransferController],
  exports: [StockTransferService],
})
export class StockTransferModule {}
