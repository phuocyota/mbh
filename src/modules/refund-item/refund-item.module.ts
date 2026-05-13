import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundItemService } from './refund-item.service';
import { RefundItemController } from './refund-item.controller';
import { RefundItem } from '../../entities/refund-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RefundItem])],
  providers: [RefundItemService],
  controllers: [RefundItemController],
  exports: [RefundItemService],
})
export class RefundItemModule {}
