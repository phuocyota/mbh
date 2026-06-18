import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Product,
  StockTake,
  StockTakeItem,
  StockTransaction,
} from '../../entities';
import { StockTakeController } from './stock-take.controller';
import { StockTakeService } from './stock-take.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockTake,
      StockTakeItem,
      StockTransaction,
    ]),
  ],
  providers: [StockTakeService],
  controllers: [StockTakeController],
  exports: [StockTakeService],
})
export class StockTakeModule {}
