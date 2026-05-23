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

  async createManyForRefund(refundId: string, items: any[], createdBy: string) {
    const refundItems = items.map((item) =>
      this.refundItemRepository.create({
        refundId,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        amount: item.amount,
        createdBy,
      } as Partial<RefundItem>),
    );

    return this.refundItemRepository.save(refundItems);
  }

  async findByRefund(refundId: string): Promise<RefundItem[]> {
    return this.refundItemRepository.find({
      where: { refundId },
    });
  }
}
