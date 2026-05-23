import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderItem } from '../../entities/order-item.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class OrderItemService extends BaseService<OrderItem> {
  constructor(
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
  ) {
    super(orderItemRepository);
  }

  protected getEntityName(): string {
    return 'OrderItem';
  }

  async createForOrder(
    orderId: string,
    createOrderItemDto: any,
  ): Promise<OrderItem> {
    const orderItem = this.orderItemRepository.create({
      ...createOrderItemDto,
      orderId,
      status: createOrderItemDto.status ?? 'NORMAL',
    } as Partial<OrderItem>);

    return this.orderItemRepository.save(orderItem);
  }

  async createManyForOrder(
    orderId: string,
    items: any[],
  ): Promise<OrderItem[]> {
    const orderItems = items.map((item) =>
      this.orderItemRepository.create({
        ...item,
        orderId,
        status: item.status ?? 'NORMAL',
      } as Partial<OrderItem>),
    );

    return this.orderItemRepository.save(orderItems);
  }

  async findNormalByOrder(orderId: string): Promise<OrderItem[]> {
    return this.orderItemRepository.find({
      where: { orderId, status: 'NORMAL' },
    });
  }

  async findByIdsForOrder(
    orderId: string,
    ids: string[],
  ): Promise<OrderItem[]> {
    return this.orderItemRepository.find({
      where: { id: In(ids), orderId },
    });
  }

  async markRefunded(ids: string[], updatedBy: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.orderItemRepository.update(
      { id: In(ids) },
      { status: 'REFUNDED', updatedBy },
    );
  }

  async deleteByOrder(orderId: string): Promise<void> {
    await this.orderItemRepository.delete({ orderId });
  }

  async getTopProducts(query: {
    from: Date;
    to: Date;
    branchId?: string;
    limit: number;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('SUM(oi.quantity)', 'totalQuantity')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'totalRevenue')
      .where('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere("o.status IN ('PAID','COMPLETED')")
      .andWhere("oi.status = 'NORMAL'")
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .orderBy('"totalQuantity"', 'DESC')
      .limit(query.limit);

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb.getRawMany<{
      productId: string;
      productName: string;
      totalQuantity: string;
      totalRevenue: string;
    }>();
  }
}
