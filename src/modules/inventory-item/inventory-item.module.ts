import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItemService } from './inventory-item.service';
import { InventoryItemController } from './inventory-item.controller';
import { InventoryItem } from '../../entities/inventory-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem])],
  providers: [InventoryItemService],
  controllers: [InventoryItemController],
  exports: [InventoryItemService],
})
export class InventoryItemModule {}
