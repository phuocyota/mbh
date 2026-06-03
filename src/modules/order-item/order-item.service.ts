import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderItem } from '../../entities/order-item.entity';
import { BaseService } from '../../common/sql/base.service';
import {
  ORDER_ITEM_STATUS,
  ORDER_PAYMENT_STATUS,
} from '../../common/constant/constant';

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
      status: createOrderItemDto.status ?? ORDER_ITEM_STATUS.NORMAL,
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
        status: item.status ?? ORDER_ITEM_STATUS.NORMAL,
      } as Partial<OrderItem>),
    );

    return this.orderItemRepository.save(orderItems);
  }

  async findNormalByOrder(orderId: string): Promise<OrderItem[]> {
    return this.orderItemRepository.find({
      where: { orderId, status: ORDER_ITEM_STATUS.NORMAL },
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
      { status: ORDER_ITEM_STATUS.REFUNDED, updatedBy },
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
      .andWhere('o.payment_status = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('oi.status = :itemStatus', {
        itemStatus: ORDER_ITEM_STATUS.NORMAL,
      })
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

  async getBottomProducts(query: {
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
      .andWhere('o.payment_status = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('oi.status = :itemStatus', {
        itemStatus: ORDER_ITEM_STATUS.NORMAL,
      })
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .orderBy('"totalQuantity"', 'ASC')
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

  async getEndOfDayItems(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('DATE(o.created_at)', 'date')
      .addSelect('p.sku', 'code')
      .addSelect('oi.product_name', 'name')
      .addSelect('oi.unit_price', 'price')
      .addSelect('SUM(oi.quantity)', 'qty')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'total')
      .addSelect('COALESCE(SUM(oi.subtotal), 0)', 'gross')
      .addSelect(
        'COALESCE(SUM(oi.total_amount) * 0.1, 0)',
        'tax',
      )
      .addSelect(
        'COALESCE(SUM(oi.total_amount) * 0.9, 0)',
        'net',
      )
      .leftJoin('products', 'p', 'p.id = oi.product_id')
      .where('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('o.payment_status = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('oi.status = :itemStatus', {
        itemStatus: ORDER_ITEM_STATUS.NORMAL,
      })
      .groupBy('DATE(o.created_at)')
      .addGroupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .addGroupBy('oi.unit_price')
      .addGroupBy('p.sku')
      .orderBy('DATE(o.created_at)', 'ASC')
      .addOrderBy('oi.product_name', 'ASC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb.getRawMany<{
      date: string;
      code: string;
      name: string;
      price: string;
      qty: string;
      total: string;
      gross: string;
      tax: string;
      net: string;
    }>();
  }
}
