import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketItemService } from './kitchen-ticket-item.service';
import { KitchenTicketItemController } from './kitchen-ticket-item.controller';
import { KitchenTicketItem } from '../../entities/kitchen-ticket-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KitchenTicketItem])],
  providers: [KitchenTicketItemService],
  controllers: [KitchenTicketItemController],
  exports: [KitchenTicketItemService],
})
export class KitchenTicketItemModule {}
