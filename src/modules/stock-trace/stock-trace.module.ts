import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTraceController } from './stock-trace.controller';
import { StockTraceService } from './stock-trace.service';
import { ProductionTraceController } from '../production-trace/production-trace.controller';
import {
  StockLot,
  StockMovement,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  Product,
  Supplier,
  Branch,
  Stock,
  ProductRecipe,
  ProductRecipeItem,
  KitchenProductionBatch,
  KitchenOperation,
} from '../../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockLot,
      StockMovement,
      StockReceiptDetail,
      StockReceiptImport,
      StockReceiptExport,
      Product,
      Supplier,
      Branch,
      Stock,
      ProductRecipe,
      ProductRecipeItem,
      KitchenProductionBatch,
      KitchenOperation,
    ]),
  ],
  controllers: [StockTraceController, ProductionTraceController],
  providers: [StockTraceService],
  exports: [StockTraceService],
})
export class StockTraceModule {}
