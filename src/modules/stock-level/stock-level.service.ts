import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockLevel } from '../../entities/stock-level.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class StockLevelService extends BaseService<StockLevel> {
  constructor(
    @InjectRepository(StockLevel)
    private stockLevelRepository: Repository<StockLevel>,
  ) {
    super(stockLevelRepository);
  }

  protected getEntityName(): string {
    return 'StockLevel';
  }
}
