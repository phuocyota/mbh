import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealItem } from '../../entities/meal-item.entity';
import { MealItemController } from './meal-item.controller';
import { MealItemService } from './meal-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([MealItem])],
  providers: [MealItemService],
  controllers: [MealItemController],
  exports: [MealItemService],
})
export class MealItemModule {}
