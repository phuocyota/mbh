import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KitchenTicketItem } from '../../entities/kitchen-ticket-item.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class KitchenTicketItemService extends BaseService<KitchenTicketItem> {
  constructor(
    @InjectRepository(KitchenTicketItem)
    private kitchenTicketItemRepository: Repository<KitchenTicketItem>,
  ) {
    super(kitchenTicketItemRepository);
  }

  protected getEntityName(): string {
    return 'KitchenTicketItem';
  }
}
