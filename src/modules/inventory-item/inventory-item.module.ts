import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Stock, StockItem } from '../../entities';
import { InventoryItemController } from './inventory-item.controller';
import { InventoryItemService } from './inventory-item.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule, TypeOrmModule.forFeature([Product, Stock, StockItem])],
  providers: [InventoryItemService],
  controllers: [InventoryItemController],
  exports: [InventoryItemService],
})
export class InventoryItemModule {}
