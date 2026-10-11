import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CustomerMealItem,
  Employee,
  KitchenAssignment,
  KitchenBatchAdjustment,
  KitchenConsumptionSession,
  KitchenMealPlan,
  KitchenOrderTicket,
  KitchenProductStation,
  KitchenProductionBatch,
  KitchenRecipe,
  KitchenRecipeItem,
  KitchenServicePeriod,
  KitchenStation,
  MealItem,
  MeasurementUnit,
  Product,
  User,
  WorkSchedule,
} from '../../entities';
import { SocketModule } from '../socket/socket.module';
import { KitchenController } from './kitchen.controller';
import { KitchenScheduler } from './kitchen.scheduler';
import { KitchenService } from './kitchen.service';
import { RolesGuard } from '../../common/guard/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeasurementUnit,
      KitchenStation,
      KitchenProductStation,
      KitchenRecipe,
      KitchenRecipeItem,
      KitchenServicePeriod,
      KitchenOrderTicket,
      KitchenMealPlan,
      KitchenProductionBatch,
      KitchenBatchAdjustment,
      KitchenConsumptionSession,
      KitchenAssignment,
      Employee,
      User,
      Product,
      MealItem,
      CustomerMealItem,
      WorkSchedule,
    ]),
    SocketModule,
  ],
  controllers: [KitchenController],
  providers: [KitchenService, KitchenScheduler, RolesGuard],
  exports: [KitchenService],
})
export class KitchenModule {}
