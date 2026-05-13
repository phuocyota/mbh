import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundItem } from '../../entities/refund-item.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class RefundItemService extends BaseService<RefundItem> {
  constructor(
    @InjectRepository(RefundItem)
    private refundItemRepository: Repository<RefundItem>,
  ) {
    super(refundItemRepository);
  }

  protected getEntityName(): string {
    return 'RefundItem';
  }
}
