import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, StockTake, StockTakeItem, Stock, StockItem } from '../../entities';
import { StockTakeController } from './stock-take.controller';
import { StockTakeService } from './stock-take.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockTake,
      StockTakeItem,
      Stock,
      StockItem,
    ]),
    StockModule,
  ],
  controllers: [StockTakeController],
  providers: [StockTakeService],
  exports: [StockTakeService],
})
export class StockTakeModule {}
