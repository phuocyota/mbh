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

  async getSnapshot(branchId?: string) {
    const qb = this.stockLevelRepository
      .createQueryBuilder('sl')
      .leftJoin('inventory_items', 'ii', 'ii.id = sl.inventory_item_id')
      .select('sl.id', 'id')
      .addSelect('sl.branch_id', 'branchId')
      .addSelect('sl.inventory_item_id', 'inventoryItemId')
      .addSelect('ii.name', 'name')
      .addSelect('ii.unit', 'unit')
      .addSelect('sl.quantity', 'quantity')
      .addSelect('sl.updated_at', 'updatedAt')
      .orderBy('ii.name', 'ASC');

    if (branchId) {
      qb.where('sl.branch_id = :branchId', { branchId });
    }

    return qb.getRawMany();
  }
}
