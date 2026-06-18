import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities';
import { InventoryItemController } from './inventory-item.controller';
import { InventoryItemService } from './inventory-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [InventoryItemService],
  controllers: [InventoryItemController],
  exports: [InventoryItemService],
})
export class InventoryItemModule {}
