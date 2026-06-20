import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, StockTake, StockTakeItem, Stock, StockItem } from '../../entities';
import { StockTakeController } from './stock-take.controller';
import { StockTakeService } from './stock-take.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockTake,
      StockTakeItem,
      Stock,
      StockItem,
    ]),
  ],
  controllers: [StockTakeController],
  providers: [StockTakeService],
  exports: [StockTakeService],
})
export class StockTakeModule {}
