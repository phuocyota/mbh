import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Stock, StockItem } from '../../entities';
import { InventoryItemController } from './inventory-item.controller';
import { InventoryItemService } from './inventory-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Stock, StockItem])],
  providers: [InventoryItemService],
  controllers: [InventoryItemController],
  exports: [InventoryItemService],
})
export class InventoryItemModule {}
