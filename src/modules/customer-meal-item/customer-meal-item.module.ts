import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerMealItem } from '../../entities/customer-meal-item.entity';
import { CustomerMealItemController } from './customer-meal-item.controller';
import { CustomerMealItemService } from './customer-meal-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerMealItem])],
  controllers: [CustomerMealItemController],
  providers: [CustomerMealItemService],
  exports: [CustomerMealItemService],
})
export class CustomerMealItemModule {}
