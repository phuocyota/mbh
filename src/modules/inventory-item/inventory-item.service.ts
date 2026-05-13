import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class InventoryItemService extends BaseService<InventoryItem> {
  constructor(
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
  ) {
    super(inventoryItemRepository);
  }

  protected getEntityName(): string {
    return 'InventoryItem';
  }
}
