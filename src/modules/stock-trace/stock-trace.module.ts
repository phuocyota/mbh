import { TraceLookupController } from '../production-trace/trace-lookup.controller';
import { TraceLookupService } from '../production-trace/trace-lookup.service';
import { StockSerialService } from '../stock/stock-serial.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTraceController } from './stock-trace.controller';
import { PublicStockTraceController } from './public-stock-trace.controller';
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
  controllers: [
    StockTraceController,
    PublicStockTraceController,
    ProductionTraceController,
    TraceLookupController,
  ],
  providers: [StockTraceService, StockSerialService, TraceLookupService],
  exports: [StockTraceService],
})
export class StockTraceModule {}
