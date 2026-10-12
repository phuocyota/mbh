import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTraceController } from './stock-trace.controller';
import { StockTraceService } from './stock-trace.service';
import {
  StockLot,
  StockMovement,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  Product,
  Supplier,
  Branch,
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
      ProductRecipe,
      ProductRecipeItem,
      KitchenProductionBatch,
      KitchenOperation,
    ]),
  ],
  controllers: [StockTraceController],
  providers: [StockTraceService],
  exports: [StockTraceService],
})
export class StockTraceModule {}
