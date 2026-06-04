import { Injectable } from '@nestjs/common';
import { OrderService } from '../orders/order.service';
import { OrderItemService } from '../order-item/order-item.service';
import { PaymentService } from '../payment/payment.service';
import { ShiftService } from '../shift/shift.service';
import { CashMovementService } from '../cash-movement/cash-movement.service';
import { StockLevelService } from '../stock-level/stock-level.service';
import { CASH_MOVEMENT_TYPE } from '../../common/constant/constant';

interface DateRange {
  from?: string;
  to?: string;
}

interface ResolvedDateRange {
  from: Date;
  to: Date;
}

type ReportUser = {
  role?: string;
  userType?: string;
  branchId?: string | null;
};

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

  private resolveRange(range: DateRange): ResolvedDateRange {
    const to = range.to ? new Date(range.to) : new Date();
    to.setHours(23, 59, 59, 999);

    const from = range.from
      ? new Date(range.from)
      : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 30);
    from.setHours(0, 0, 0, 0);

    return { from, to };
  }

  private resolveCustomerRange(query: {
    from?: string;
    to?: string;
    filter?: string;
  }): ResolvedDateRange {
    if (query.from || query.to) {
      return this.resolveRange(query);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = new Date(today);
    from.setHours(0, 0, 0, 0);
    let to = new Date(today);
    to.setHours(23, 59, 59, 999);

    switch (query.filter || '7days') {
      case 'today':
        break;
      case 'yesterday':
        from.setDate(from.getDate() - 1);
        to.setDate(to.getDate() - 1);
        break;
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        to.setHours(23, 59, 59, 999);
        break;
      case '7days':
      default:
        from.setDate(from.getDate() - 6);
        break;
    }

    return { from, to };
  }

  private resolveMonthlyRange(query: {
    from?: string;
    to?: string;
    month?: string;
  }): ResolvedDateRange {
    if (query.from || query.to) {
      return this.resolveRange(query);
    }

    const now = new Date();
    const [year, month] = (query.month || '').split('-').map(Number);
    const resolvedYear = Number.isInteger(year) ? year : now.getFullYear();
    const resolvedMonth = Number.isInteger(month) ? month - 1 : now.getMonth();

    const from = new Date(resolvedYear, resolvedMonth, 1);
    from.setHours(0, 0, 0, 0);

    const to = new Date(resolvedYear, resolvedMonth + 1, 0);
    to.setHours(23, 59, 59, 999);

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

  async servingStats(query: { branchId?: string }) {
    const row = await this.orderService.getServingStatsRow({
      branchId: query.branchId,
    });

    return {
      branchId: query.branchId || null,
      servingOrders: Number(row?.servingOrders || 0),
      servingCustomers: Number(row?.servingCustomers || 0),
    };
  }

  async customerStats(query: {
    from?: string;
    to?: string;
    branchId?: string;
    filter?: string;
  }) {
    const { from, to } = this.resolveCustomerRange(query);
    const { dailyRows, totalRow } =
      await this.orderService.getCustomerStatsRows({
        from,
        to,
        branchId: query.branchId,
      });

    return {
      filter: query.filter || null,
      from,
      to,
      branchId: query.branchId || null,
      totalCustomers: Number(totalRow?.count || 0),
      daily: dailyRows.map((row) => ({
        date: row.date,
        customers: Number(row.uniqueCustomers),
        orders: Number(row.totalOrders),
      })),
    };
  }

  async menuPerformance(query: {
    from?: string;
    to?: string;
    branchId?: string;
    filter?: string;
    groupBy?: 'category' | 'type';
  }) {
    const { from, to } = this.resolveCustomerRange(query);
    const groupBy = query.groupBy || 'category';
    const [averageRow, groupRows] = await Promise.all([
      this.orderItemService.getMenuAverageRows({
        from,
        to,
        branchId: query.branchId,
      }),
      this.orderItemService.getMenuPerformanceGroups({
        from,
        to,
        branchId: query.branchId,
        groupBy,
      }),
    ]);

    const totalRevenue = Number(averageRow?.totalRevenue || 0);
    const totalQuantity = Number(averageRow?.totalQuantity || 0);
    const foodRevenue = Number(averageRow?.foodRevenue || 0);
    const foodQuantity = Number(averageRow?.foodQuantity || 0);
    const drinkRevenue = Number(averageRow?.drinkRevenue || 0);
    const drinkQuantity = Number(averageRow?.drinkQuantity || 0);

    return {
      filter: query.filter || null,
      from,
      to,
      branchId: query.branchId || null,
      groupBy,
      summary: {
        averagePerItem: this.safeAverage(totalRevenue, totalQuantity),
        averageFood: this.safeAverage(foodRevenue, foodQuantity),
        averageDrink: this.safeAverage(drinkRevenue, drinkQuantity),
        totalRevenue,
        totalQuantity,
      },
      groups: groupRows.map((row) => {
        const revenue = Number(row.revenue || 0);
        return {
          id: row.id,
          name: row.name,
          revenue,
          quantity: Number(row.quantity || 0),
          orderCount: Number(row.orderCount || 0),
          percentage:
            totalRevenue > 0
              ? Number(((revenue / totalRevenue) * 100).toFixed(2))
              : 0,
        };
      }),
    };
  }

  async cancellationReport(query: {
    from?: string;
    to?: string;
    branchId?: string;
    filter?: string;
  }) {
    const { from, to } = this.resolveCustomerRange(query);
    const reportRows = await this.orderItemService.getCancellationReportRows({
      from,
      to,
      branchId: query.branchId,
    });

    const stageConfigs = [
      {
        key: 'afterKitchen',
        name: 'Hủy sau báo bếp',
        color: '#ff2d55',
        rows: reportRows.stages.afterKitchen,
      },
      {
        key: 'afterCheckout',
        name: 'Hủy sau tạm tính',
        color: '#ff7a00',
        rows: reportRows.stages.afterCheckout,
      },
      {
        key: 'afterInspection',
        name: 'Hủy khi kiểm đồ',
        color: '#ffc400',
        rows: reportRows.stages.afterInspection,
      },
    ];

    const totalCancelledItems = stageConfigs.reduce(
      (sum, stage) =>
        sum +
        stage.rows.reduce(
          (stageSum, row) => stageSum + Number(row.quantity || 0),
          0,
        ),
      0,
    );

    return {
      filter: query.filter || null,
      from,
      to,
      branchId: query.branchId || null,
      summary: {
        cancelledItems: totalCancelledItems,
        cancelledInvoices: reportRows.cancelledInvoiceCount,
      },
      stages: stageConfigs.map((stage) => {
        const itemCount = stage.rows.reduce(
          (sum, row) => sum + Number(row.quantity || 0),
          0,
        );
        const amount = stage.rows.reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0,
        );

        return {
          key: stage.key,
          name: stage.name,
          color: stage.color,
          itemCount,
          amount,
          percentage:
            totalCancelledItems > 0
              ? Number(((itemCount / totalCancelledItems) * 100).toFixed(2))
              : 0,
          items: stage.rows.map((row) => ({
            productId: row.productId,
            productName: row.productName,
            quantity: Number(row.quantity || 0),
            amount: Number(row.amount || 0),
            invoiceCount: Number(row.invoiceCount || 0),
          })),
        };
      }),
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
      .filter((movement) => movement.type === CASH_MOVEMENT_TYPE.CASH_IN)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
    const cashOut = movements
      .filter((movement) => movement.type === CASH_MOVEMENT_TYPE.CASH_OUT)
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

  async endOfDay(query: { from?: string; to?: string; branchId?: string }) {
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

  async monthlyOrderPlan(query: {
    from?: string;
    to?: string;
    month?: string;
    branchId?: string;
    minRate?: number;
    maxRate?: number;
  }, user?: ReportUser) {
    const { from, to } = this.resolveMonthlyRange(query);
    const userRole = user?.userType || user?.role;
    const branchId =
      userRole === 'MANAGER'
        ? user?.branchId || query.branchId
        : query.branchId || user?.branchId || undefined;
    const minRate = Number(query.minRate || 1.2);
    const maxRate = Number(query.maxRate || 1.5);
    const [rows, revenueRows] = await Promise.all([
      this.orderItemService.getMonthlyOrderPlanRows({
        from,
        to,
        branchId,
        minRate,
        maxRate,
      }),
      this.orderService.getRevenueSummaryRows({
        from,
        to,
        branchId,
      }),
    ]);

    const revenueMonth = Number(revenueRows.totalRow?.totalRevenue || 0);
    const firstRow = rows[0];

    return {
      companyName: 'CONG TY TNHH KIDO EDU',
      schoolName: firstRow?.branchName || 'KIDO',
      title: 'Ke hoach dat hang hoa trong Thang',
      from,
      to,
      month: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
      branchId: branchId || firstRow?.branchId || null,
      branchName: firstRow?.branchName || null,
      revenueMonth,
      note: 'Doanh thu cua thang truoc do ma minh muon lay lam du lieu',
      planSalesImportWindow: {
        minRate,
        maxRate,
        minPercent: Math.round(minRate * 100),
        maxPercent: Math.round(maxRate * 100),
      },
      dataAvailable: {
        stockOnHand: false,
        usagePerMil: false,
      },
      data: rows.map((row, index) => {
        const monthlyUsage = Number(row.monthlyUsage || 0);
        const minPlan = Math.ceil(monthlyUsage * minRate);
        const maxPlan = Math.ceil(monthlyUsage * maxRate);
        const stockOnHand: number | null = null;

        return {
          stt: index + 1,
          group: row.groupName,
          code: row.code,
          productId: row.productId,
          name: row.name,
          unit: row.unit,
          monthlyUsage,
          stockOnHand,
          usagePerMil: null,
          planSales: {
            min: minPlan,
            max: maxPlan,
          },
          warningQuantity: null,
          suggestedOrderQuantity:
            stockOnHand === null ? maxPlan : Math.max(maxPlan - stockOnHand, 0),
          revenue: Number(row.revenue || 0),
        };
      }),
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

  private safeAverage(total: number, quantity: number) {
    if (quantity <= 0) {
      return 0;
    }

    return Math.round(total / quantity);
  }
}
