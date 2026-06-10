import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderItem } from '../../entities/order-item.entity';
import { BaseService } from '../../common/sql/base.service';
import {
  ORDER_ITEM_STATUS,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  REFUND_STATUS,
} from '../../common/constant/constant';

type CancellationRow = {
  productId: string;
  productName: string;
  quantity: string;
  amount: string;
  invoiceCount: string;
};

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

  async getEndOfDayItems(query: { from: Date; to: Date; branchId?: string }) {
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
      .addSelect('COALESCE(SUM(oi.total_amount) * 0.1, 0)', 'tax')
      .addSelect('COALESCE(SUM(oi.total_amount) * 0.9, 0)', 'net')
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

  async getMonthlyOrderPlanRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
    minRate: number;
    maxRate: number;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .leftJoin('products', 'p', 'p.id = oi.product_id')
      .leftJoin('categories', 'c', 'c.id = p.category_id')
      .leftJoin('branches', 'b', 'b.id = o.branch_id')
      .select("COALESCE(c.name, 'Chua phan loai')", 'groupName')
      .addSelect('p.sku', 'code')
      .addSelect('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'name')
      .addSelect('p.unit', 'unit')
      .addSelect('SUM(oi.quantity)', 'monthlyUsage')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'revenue')
      .addSelect('o.branch_id', 'branchId')
      .addSelect('b.name', 'branchName')
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
      .groupBy('c.name')
      .addGroupBy('p.sku')
      .addGroupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .addGroupBy('p.unit')
      .addGroupBy('o.branch_id')
      .addGroupBy('b.name')
      .orderBy('c.name', 'ASC')
      .addOrderBy('oi.product_name', 'ASC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb.getRawMany<{
      groupName: string;
      code: string | null;
      productId: string;
      name: string;
      unit: string | null;
      monthlyUsage: string;
      revenue: string;
      branchId: string | null;
      branchName: string | null;
    }>();
  }

  async getEmployeeCashierRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
    employeeId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .leftJoin('users', 'u', 'u.id = o.cashier_id')
      .select("COALESCE(CAST(o.cashier_id AS text), 'unknown')", 'id')
      .addSelect("COALESCE(u.full_name, 'Không xác định')", 'employee')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'revenue')
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
      .groupBy('o.cashier_id')
      .addGroupBy('u.full_name')
      .orderBy('"revenue"', 'DESC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.employeeId) {
      qb.andWhere('o.cashier_id = :employeeId', {
        employeeId: query.employeeId,
      });
    }

    return qb.getRawMany<{
      id: string;
      employee: string;
      quantity: string;
      revenue: string;
    }>();
  }

  async getEmployeeProfitRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
    employeeId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .leftJoin('users', 'u', 'u.id = o.cashier_id')
      .leftJoin('products', 'p', 'p.id = oi.product_id')
      .select("COALESCE(CAST(o.cashier_id AS text), 'unknown')", 'id')
      .addSelect("COALESCE(u.full_name, 'Không xác định')", 'employee')
      .addSelect('COALESCE(SUM(oi.subtotal), 0)', 'totalPurchase')
      .addSelect('COALESCE(SUM(oi.discount_amount), 0)', 'discount')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'revenue')
      .addSelect(
        'COALESCE(SUM(COALESCE(p.cost_price, 0) * oi.quantity), 0)',
        'cost',
      )
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
      .groupBy('o.cashier_id')
      .addGroupBy('u.full_name')
      .orderBy('"revenue"', 'DESC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.employeeId) {
      qb.andWhere('o.cashier_id = :employeeId', {
        employeeId: query.employeeId,
      });
    }

    return qb.getRawMany<{
      id: string;
      employee: string;
      totalPurchase: string;
      discount: string;
      revenue: string;
      cost: string;
    }>();
  }

  async getMenuAverageRows(query: { from: Date; to: Date; branchId?: string }) {
    const itemTypeCase = this.getMenuItemTypeCase();
    const qb = this.createMenuPerformanceBaseQuery(query)
      .select('COALESCE(SUM(oi.total_amount), 0)', 'totalRevenue')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'totalQuantity')
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${itemTypeCase} = 'FOOD' THEN oi.total_amount ELSE 0 END), 0)`,
        'foodRevenue',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${itemTypeCase} = 'FOOD' THEN oi.quantity ELSE 0 END), 0)`,
        'foodQuantity',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${itemTypeCase} = 'DRINK' THEN oi.total_amount ELSE 0 END), 0)`,
        'drinkRevenue',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${itemTypeCase} = 'DRINK' THEN oi.quantity ELSE 0 END), 0)`,
        'drinkQuantity',
      );

    return qb.getRawOne<{
      totalRevenue: string;
      totalQuantity: string;
      foodRevenue: string;
      foodQuantity: string;
      drinkRevenue: string;
      drinkQuantity: string;
    }>();
  }

  async getMenuPerformanceGroups(query: {
    from: Date;
    to: Date;
    branchId?: string;
    groupBy: 'category' | 'type';
  }) {
    const itemTypeCase = this.getMenuItemTypeCase();
    const groupId =
      query.groupBy === 'type'
        ? itemTypeCase
        : "COALESCE(CAST(c.id AS text), 'unknown')";
    const groupName =
      query.groupBy === 'type'
        ? `CASE WHEN ${itemTypeCase} = 'DRINK' THEN 'Đồ uống' ELSE 'Đồ ăn' END`
        : "COALESCE(c.name, 'Chưa phân loại')";

    const qb = this.createMenuPerformanceBaseQuery(query)
      .select(groupId, 'id')
      .addSelect(groupName, 'name')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'revenue')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'quantity')
      .addSelect('COUNT(DISTINCT o.id)', 'orderCount')
      .groupBy(groupId)
      .addGroupBy(groupName)
      .orderBy('"revenue"', 'DESC');

    return qb.getRawMany<{
      id: string;
      name: string;
      revenue: string;
      quantity: string;
      orderCount: string;
    }>();
  }

  async getCancellationReportRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const [afterKitchenRows, afterCheckoutRows, afterInspectionRows] =
      await Promise.all([
        this.getAfterKitchenCancellationRows(query),
        this.getAfterCheckoutCancellationRows(query),
        this.getAfterInspectionCancellationRows(query),
      ]);

    const cancelledInvoiceCount = await this.getCancelledInvoiceCount(query);

    return {
      cancelledInvoiceCount,
      stages: {
        afterKitchen: afterKitchenRows,
        afterCheckout: afterCheckoutRows,
        afterInspection: afterInspectionRows,
      },
    };
  }

  private createMenuPerformanceBaseQuery(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .leftJoin('products', 'p', 'p.id = oi.product_id')
      .leftJoin('categories', 'c', 'c.id = p.category_id')
      .where('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('o.payment_status = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('oi.status = :itemStatus', {
        itemStatus: ORDER_ITEM_STATUS.NORMAL,
      });

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb;
  }

  private async getAfterKitchenCancellationRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const itemCancelQb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('SUM(oi.quantity)', 'quantity')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT o.id)', 'invoiceCount')
      .where('oi.updated_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('oi.status = :itemStatus', {
        itemStatus: ORDER_ITEM_STATUS.CANCELLED,
      })
      .andWhere('o.status != :cancelledOrderStatus', {
        cancelledOrderStatus: ORDER_STATUS.CANCELLED,
      })
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM kitchen_ticket_items kti
          INNER JOIN kitchen_tickets kt ON kt.id = kti.kitchen_ticket_id
          WHERE kti.order_item_id = oi.id OR kt.order_id = o.id
        )`,
      )
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name');

    const orderCancelQb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('SUM(oi.quantity)', 'quantity')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT o.id)', 'invoiceCount')
      .where('o.cancelled_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('o.status = :cancelledOrderStatus', {
        cancelledOrderStatus: ORDER_STATUS.CANCELLED,
      })
      .andWhere('oi.status != :refundedItemStatus', {
        refundedItemStatus: ORDER_ITEM_STATUS.REFUNDED,
      })
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM kitchen_tickets kt
          WHERE kt.order_id = o.id
        )`,
      )
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name');

    if (query.branchId) {
      itemCancelQb.andWhere('o.branch_id = :branchId', {
        branchId: query.branchId,
      });
      orderCancelQb.andWhere('o.branch_id = :branchId', {
        branchId: query.branchId,
      });
    }

    return this.mergeCancellationRows([
      ...(await itemCancelQb.getRawMany<CancellationRow>()),
      ...(await orderCancelQb.getRawMany<CancellationRow>()),
    ]);
  }

  private async getAfterCheckoutCancellationRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('SUM(oi.quantity)', 'quantity')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT o.id)', 'invoiceCount')
      .where('o.cancelled_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('o.status = :cancelledOrderStatus', {
        cancelledOrderStatus: ORDER_STATUS.CANCELLED,
      })
      .andWhere('oi.status != :refundedItemStatus', {
        refundedItemStatus: ORDER_ITEM_STATUS.REFUNDED,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM kitchen_tickets kt
          WHERE kt.order_id = o.id
        )`,
      )
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .orderBy('"quantity"', 'DESC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb.getRawMany<CancellationRow>();
  }

  private async getAfterInspectionCancellationRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('refund_items', 'ri', 'ri.order_item_id = oi.id')
      .innerJoin('refunds', 'r', 'r.id = ri.refund_id')
      .innerJoin('orders', 'o', 'o.id = r.order_id')
      .select('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('SUM(ri.quantity)', 'quantity')
      .addSelect('COALESCE(SUM(ri.amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT o.id)', 'invoiceCount')
      .where(
        'COALESCE(r.completed_at, r.updated_at, r.created_at) BETWEEN :from AND :to',
        {
          from: query.from,
          to: query.to,
        },
      )
      .andWhere('r.status = :refundStatus', {
        refundStatus: REFUND_STATUS.COMPLETED,
      })
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .orderBy('"quantity"', 'DESC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb.getRawMany<CancellationRow>();
  }

  private async getCancelledInvoiceCount(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('COUNT(DISTINCT o.id)', 'count')
      .where('o.cancelled_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere('o.status = :cancelledOrderStatus', {
        cancelledOrderStatus: ORDER_STATUS.CANCELLED,
      });

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count || 0);
  }

  private mergeCancellationRows(rows: CancellationRow[]) {
    const merged = new Map<string, CancellationRow>();

    for (const row of rows) {
      const key = row.productId || row.productName;
      const current = merged.get(key);
      if (!current) {
        merged.set(key, { ...row });
        continue;
      }

      current.quantity = String(
        Number(current.quantity || 0) + Number(row.quantity || 0),
      );
      current.amount = String(
        Number(current.amount || 0) + Number(row.amount || 0),
      );
      current.invoiceCount = String(
        Number(current.invoiceCount || 0) + Number(row.invoiceCount || 0),
      );
    }

    return Array.from(merged.values()).sort(
      (a, b) => Number(b.quantity || 0) - Number(a.quantity || 0),
    );
  }

  private getMenuItemTypeCase() {
    return `
      CASE
        WHEN COALESCE(c.name, '') ILIKE '%đồ uống%'
          OR COALESCE(c.name, '') ILIKE '%do uong%'
          OR COALESCE(c.name, '') ILIKE '%nước%'
          OR COALESCE(c.name, '') ILIKE '%nuoc%'
          OR lower(COALESCE(p.unit, '')) IN ('ly', 'coc', 'cốc', 'chai', 'lon')
        THEN 'DRINK'
        ELSE 'FOOD'
      END
    `;
  }
}
