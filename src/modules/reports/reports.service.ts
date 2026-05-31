import { Injectable } from '@nestjs/common';
import { OrderService } from '../orders/order.service';
import { OrderItemService } from '../order-item/order-item.service';
import { PaymentService } from '../payment/payment.service';
import { ShiftService } from '../shift/shift.service';
import { CashMovementService } from '../cash-movement/cash-movement.service';
import { StockLevelService } from '../stock-level/stock-level.service';

interface DateRange {
  from?: string;
  to?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private orderService: OrderService,
    private orderItemService: OrderItemService,
    private paymentService: PaymentService,
    private shiftService: ShiftService,
    private cashMovementService: CashMovementService,
    private stockLevelService: StockLevelService,
  ) {}

  private resolveRange(range: DateRange): { from: Date; to: Date } {
    const to = range.to ? new Date(range.to) : new Date();
    to.setHours(23, 59, 59, 999);

    const from = range.from
      ? new Date(range.from)
      : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 30);
    from.setHours(0, 0, 0, 0);

    return { from, to };
  }

  async revenueSummary(query: {
    from?: string;
    to?: string;
    branchId?: string;
  }) {
    const { from, to } = this.resolveRange(query);
    const { totalRow, refundedRow } =
      await this.orderService.getRevenueSummaryRows({
        from,
        to,
        branchId: query.branchId,
      });
    const paymentBreakdown = await this.paymentService.getPaymentBreakdown({
      from,
      to,
      branchId: query.branchId,
    });

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
      paymentBreakdown: paymentBreakdown.map((payment) => ({
        method: payment.method,
        count: Number(payment.count),
        amount: Number(payment.amount),
      })),
    };
  }

  async revenueDaily(query: { from?: string; to?: string; branchId?: string }) {
    const { from, to } = this.resolveRange(query);
    const rows = await this.orderService.getDailyRevenueRows({
      from,
      to,
      branchId: query.branchId,
    });

    return {
      from,
      to,
      branchId: query.branchId || null,
      data: rows.map((row) => ({
        day: row.day,
        orderCount: Number(row.orderCount),
        revenue: Number(row.revenue),
      })),
    };
  }

  async topProducts(query: {
    from?: string;
    to?: string;
    branchId?: string;
    limit?: number;
  }) {
    const { from, to } = this.resolveRange(query);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const rows = await this.orderItemService.getTopProducts({
      from,
      to,
      branchId: query.branchId,
      limit,
    });

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      totalQuantity: Number(row.totalQuantity),
      totalRevenue: Number(row.totalRevenue),
    }));
  }

  async shiftSummary(shiftId: string) {
    const shift = await this.shiftService.findByIdOrThrow(shiftId);
    const rangeFrom = shift.openedAt;
    const rangeTo = shift.closedAt || new Date();

    const ordersAggr = await this.orderService.getShiftOrderAggregate({
      cashierId: shift.cashierId,
      branchId: shift.branchId,
      from: rangeFrom,
      to: rangeTo,
    });
    const cashAggr = await this.paymentService.getShiftCashAggregate({
      cashierId: shift.cashierId,
      branchId: shift.branchId,
      from: rangeFrom,
      to: rangeTo,
    });
    const movements = await this.cashMovementService.findByShift(shift.id);

    const cashIn = movements
      .filter((movement) => movement.type === 'CASH_IN')
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
    const cashOut = movements
      .filter((movement) => movement.type === 'CASH_OUT')
      .reduce((sum, movement) => sum + Number(movement.amount), 0);

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

  async stockSnapshot(branchId?: string) {
    return this.stockLevelService.getSnapshot(branchId);
  }

  async bottomProducts(query: {
    from?: string;
    to?: string;
    branchId?: string;
    limit?: number;
  }) {
    const { from, to } = this.resolveRange(query);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const rows = await this.orderItemService.getBottomProducts({
      from,
      to,
      branchId: query.branchId,
      limit,
    });

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      totalQuantity: Number(row.totalQuantity),
      totalRevenue: Number(row.totalRevenue),
    }));
  }

  async endOfDay(query: {
    from?: string;
    to?: string;
    branchId?: string;
  }) {
    const { from, to } = this.resolveRange(query);
    const rows = await this.orderItemService.getEndOfDayItems({
      from,
      to,
      branchId: query.branchId,
    });

    return {
      from,
      to,
      branchId: query.branchId || null,
      data: rows.map((row) => ({
        date: row.date,
        code: row.code,
        name: row.name,
        price: Number(row.price),
        qty: Number(row.qty),
        total: Number(row.total),
        gross: Number(row.gross),
        tax: Number(row.tax),
        net: Number(row.net),
      })),
    };
  }

  async inventoryReport(branchId?: string) {
    const snapshot = await this.stockLevelService.getSnapshot(branchId);
    return {
      branchId: branchId || null,
      data: snapshot.map((item: any) => ({
        inventoryItemId: item.inventoryItemId,
        name: item.name,
        unit: item.unit,
        quantity: Number(item.quantity),
        branchId: item.branchId,
        updatedAt: item.updatedAt,
      })),
    };
  }
}
