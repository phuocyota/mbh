import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealItem } from '../../entities/meal-item.entity';
import { Customer } from '../../entities/customer.entity';
import { CustomerMealItem } from '../../entities/customer-meal-item.entity';
import { MealItemController } from './meal-item.controller';
import { MealItemService } from './meal-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([MealItem, Customer, CustomerMealItem])],
  providers: [MealItemService],
  controllers: [MealItemController],
  exports: [MealItemService],
})
export class MealItemModule {}
