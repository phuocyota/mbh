import { StockMovementService } from './stock-movement.service';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { StockLotController } from './stock-lot.controller';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from '../../entities/stock.entity';
import { StockService } from './stock.service';

@Module({
  imports: [TypeOrmModule.forFeature([Stock])],
  controllers: [StockLotController, WarehouseController],
  providers: [StockService, StockMovementService, WarehouseService],
  exports: [StockService, StockMovementService],
})
export class StockModule {}
