import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockTransaction } from '../../entities/stock-transaction.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class StockTransactionService extends BaseService<StockTransaction> {
  constructor(
    @InjectRepository(StockTransaction)
    private stockTransactionRepository: Repository<StockTransaction>,
  ) {
    super(stockTransactionRepository);
  }

  protected getEntityName(): string {
    return 'StockTransaction';
  }
}
