import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../../entities/customer.entity';
import { CustomerMealItem } from '../../entities/customer-meal-item.entity';
import { MealItem } from '../../entities/meal-item.entity';
import { CustomerMealItemController } from './customer-meal-item.controller';
import { CustomerMealItemService } from './customer-meal-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerMealItem, Customer, MealItem])],
  controllers: [CustomerMealItemController],
  providers: [CustomerMealItemService],
  exports: [CustomerMealItemService],
})
export class CustomerMealItemModule {}
