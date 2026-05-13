import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Payment } from '../../entities/payment.entity';
import { Shift } from '../../entities/shift.entity';
import { CashMovement } from '../../entities/cash-movement.entity';
import { StockLevel } from '../../entities/stock-level.entity';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';

interface DateRange {
  from?: string;
  to?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(CashMovement)
    private cashMovementRepository: Repository<CashMovement>,
    @InjectRepository(StockLevel)
    private stockLevelRepository: Repository<StockLevel>,
  ) {}

  private resolveRange(range: DateRange): { from: Date; to: Date } {
    const to = range.to ? new Date(range.to) : new Date();
    // include the entire `to` day
    to.setHours(23, 59, 59, 999);

    const from = range.from
      ? new Date(range.from)
      : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 30);
    from.setHours(0, 0, 0, 0);

    return { from, to };
  }

  /**
   * Tổng quan doanh thu trong khoảng + breakdown theo phương thức TT.
   */
  async revenueSummary(query: { from?: string; to?: string; branchId?: string }) {
    const { from, to } = this.resolveRange(query);

    const orderQb = this.orderRepository
      .createQueryBuilder('o')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere("o.status IN ('PAID','COMPLETED')");
    if (query.branchId) {
      orderQb.andWhere('o.branch_id = :branchId', {
        branchId: query.branchId,
      });
    }

    const totalRow = await orderQb
      .clone()
      .select('COUNT(o.id)', 'orderCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalRevenue')
      .addSelect('COALESCE(SUM(o.discount_amount), 0)', 'totalDiscount')
      .getRawOne<{
        orderCount: string;
        totalRevenue: string;
        totalDiscount: string;
      }>();

    const refundedRow = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere("o.payment_status = 'REFUNDED'")
      .andWhere(
        query.branchId ? 'o.branch_id = :branchId' : '1=1',
        query.branchId ? { branchId: query.branchId } : {},
      )
      .select('COUNT(o.id)', 'refundCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'refundAmount')
      .getRawOne<{ refundCount: string; refundAmount: string }>();

    // Payment method breakdown
    const paymentQb = this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('orders', 'o', 'o.id = p.order_id')
      .where('p.created_at BETWEEN :from AND :to', { from, to })
      .andWhere("p.status = 'SUCCESS'");
    if (query.branchId) {
      paymentQb.andWhere('o.branch_id = :branchId', {
        branchId: query.branchId,
      });
    }
    const paymentBreakdown = await paymentQb
      .select('p.method', 'method')
      .addSelect('COUNT(p.id)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .groupBy('p.method')
      .getRawMany<{ method: string; count: string; amount: string }>();

    return {
      from,
      to,
      branchId: query.branchId || null,
      orderCount: Number(totalRow?.orderCount || 0),
      totalRevenue: Number(totalRow?.totalRevenue || 0),
      totalDiscount: Number(totalRow?.totalDiscount || 0),
      refundCount: Number(refundedRow?.refundCount || 0),
      refundAmount: Number(refundedRow?.refundAmount || 0),
      netRevenue:
        Number(totalRow?.totalRevenue || 0) -
        Number(refundedRow?.refundAmount || 0),
      paymentBreakdown: paymentBreakdown.map((p) => ({
        method: p.method,
        count: Number(p.count),
        amount: Number(p.amount),
      })),
    };
  }

  /**
   * Doanh thu chi tiết theo từng ngày trong khoảng.
   */
  async revenueDaily(query: { from?: string; to?: string; branchId?: string }) {
    const { from, to } = this.resolveRange(query);

    const qb = this.orderRepository
      .createQueryBuilder('o')
      .select("TO_CHAR(o.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(o.id)', 'orderCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere("o.status IN ('PAID','COMPLETED')")
      .groupBy('day')
      .orderBy('day', 'ASC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    const rows = await qb.getRawMany<{
      day: string;
      orderCount: string;
      revenue: string;
    }>();

    return {
      from,
      to,
      branchId: query.branchId || null,
      data: rows.map((r) => ({
        day: r.day,
        orderCount: Number(r.orderCount),
        revenue: Number(r.revenue),
      })),
    };
  }

  /**
   * Top sản phẩm bán chạy trong khoảng.
   */
  async topProducts(query: {
    from?: string;
    to?: string;
    branchId?: string;
    limit?: number;
  }) {
    const { from, to } = this.resolveRange(query);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);

    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id')
      .select('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('SUM(oi.quantity)', 'totalQuantity')
      .addSelect('COALESCE(SUM(oi.total_amount), 0)', 'totalRevenue')
      .where('o.created_at BETWEEN :from AND :to', { from, to })
      .andWhere("o.status IN ('PAID','COMPLETED')")
      .andWhere("oi.status = 'NORMAL'")
      .groupBy('oi.product_id')
      .addGroupBy('oi.product_name')
      .orderBy('"totalQuantity"', 'DESC')
      .limit(limit);

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    const rows = await qb.getRawMany<{
      productId: string;
      productName: string;
      totalQuantity: string;
      totalRevenue: string;
    }>();

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      totalQuantity: Number(r.totalQuantity),
      totalRevenue: Number(r.totalRevenue),
    }));
  }

  /**
   * Tổng kết 1 ca: orders, doanh thu, cash in/out, expected vs closing cash.
   */
  async shiftSummary(shiftId: string) {
    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId },
    });
    if (!shift) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Shift', shiftId),
      );
    }

    const rangeFrom = shift.openedAt;
    const rangeTo = shift.closedAt || new Date();

    // Orders within shift in same branch + same cashier
    const ordersAggr = await this.orderRepository
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'orderCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalRevenue')
      .where('o.cashier_id = :cashierId', { cashierId: shift.cashierId })
      .andWhere('o.branch_id = :branchId', { branchId: shift.branchId })
      .andWhere('o.created_at BETWEEN :from AND :to', {
        from: rangeFrom,
        to: rangeTo,
      })
      .andWhere("o.status IN ('PAID','COMPLETED')")
      .getRawOne<{ orderCount: string; totalRevenue: string }>();

    const cashAggr = await this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('orders', 'o', 'o.id = p.order_id')
      .select("COALESCE(SUM(CASE WHEN p.method = 'CASH' THEN p.amount ELSE 0 END), 0)", 'cashRevenue')
      .addSelect("COALESCE(SUM(CASE WHEN p.method = 'WALLET' THEN p.amount ELSE 0 END), 0)", 'walletRevenue')
      .addSelect("COALESCE(SUM(CASE WHEN p.method NOT IN ('CASH','WALLET') THEN p.amount ELSE 0 END), 0)", 'otherRevenue')
      .where('o.cashier_id = :cashierId', { cashierId: shift.cashierId })
      .andWhere('o.branch_id = :branchId', { branchId: shift.branchId })
      .andWhere('p.created_at BETWEEN :from AND :to', {
        from: rangeFrom,
        to: rangeTo,
      })
      .andWhere("p.status = 'SUCCESS'")
      .getRawOne<{
        cashRevenue: string;
        walletRevenue: string;
        otherRevenue: string;
      }>();

    const movements = await this.cashMovementRepository.find({
      where: { shiftId: shift.id },
    });

    const cashIn = movements
      .filter((m) => m.type === 'CASH_IN')
      .reduce((s, m) => s + Number(m.amount), 0);
    const cashOut = movements
      .filter((m) => m.type === 'CASH_OUT')
      .reduce((s, m) => s + Number(m.amount), 0);

    const cashRevenue = Number(cashAggr?.cashRevenue || 0);
    const expectedCash =
      Number(shift.openingCash) + cashRevenue + cashIn - cashOut;

    return {
      shift: {
        id: shift.id,
        branchId: shift.branchId,
        cashierId: shift.cashierId,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        status: shift.status,
        openingCash: Number(shift.openingCash),
        closingCash:
          shift.closingCash != null ? Number(shift.closingCash) : null,
      },
      orders: {
        count: Number(ordersAggr?.orderCount || 0),
        totalRevenue: Number(ordersAggr?.totalRevenue || 0),
        cashRevenue,
        walletRevenue: Number(cashAggr?.walletRevenue || 0),
        otherRevenue: Number(cashAggr?.otherRevenue || 0),
      },
      cashMovements: {
        cashIn,
        cashOut,
        items: movements,
      },
      expectedCash,
      differenceCash:
        shift.closingCash != null
          ? Number(shift.closingCash) - expectedCash
          : null,
    };
  }

  /**
   * Tồn kho hiện tại theo chi nhánh (kèm tên nguyên liệu, đơn vị).
   */
  async stockSnapshot(branchId?: string) {
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
