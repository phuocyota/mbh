import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketService } from './kitchen-ticket.service';
import { KitchenTicketController } from './kitchen-ticket.controller';
import { KitchenTicket } from '../../entities/kitchen-ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KitchenTicket])],
  providers: [KitchenTicketService],
  controllers: [KitchenTicketController],
  exports: [KitchenTicketService],
})
export class KitchenTicketModule {}
