import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransactionService } from './stock-transaction.service';
import { StockTransactionController } from './stock-transaction.controller';
import { StockTransaction } from '../../entities/stock-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockTransaction])],
  providers: [StockTransactionService],
  controllers: [StockTransactionController],
  exports: [StockTransactionService],
})
export class StockTransactionModule {}
