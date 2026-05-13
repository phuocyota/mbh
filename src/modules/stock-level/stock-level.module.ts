import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLevelService } from './stock-level.service';
import { StockLevelController } from './stock-level.controller';
import { StockLevel } from '../../entities/stock-level.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockLevel])],
  providers: [StockLevelService],
  controllers: [StockLevelController],
  exports: [StockLevelService],
})
export class StockLevelModule {}
