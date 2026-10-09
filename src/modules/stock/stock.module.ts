import { StockMovementService } from './stock-movement.service';
import { StockLotController } from './stock-lot.controller';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from '../../entities/stock.entity';
import { StockService } from './stock.service';

@Module({
  imports: [TypeOrmModule.forFeature([Stock])],
  controllers: [StockLotController],
  providers: [StockService, StockMovementService],
  exports: [StockService, StockMovementService],
})
export class StockModule {}
