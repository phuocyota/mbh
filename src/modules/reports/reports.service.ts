import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, StockItem } from '../../entities';
import { OrderService } from '../orders/order.service';
import { OrderItemService } from '../order-item/order-item.service';
import { PaymentService } from '../payment/payment.service';
import { ShiftService } from '../shift/shift.service';
import { CashMovementService } from '../cash-movement/cash-movement.service';
import { CASH_MOVEMENT_TYPE, USER_ROLE } from '../../common/constant/constant';

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
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
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

  private resolveBranchId(queryBranchId?: string, user?: ReportUser) {
    const userRole = (user?.userType || user?.role || '').toUpperCase();

    if (userRole === USER_ROLE.MANAGER) {
      if (!user?.branchId) {
        throw new ForbiddenException('Manager token does not include branchId');
      }

      return user.branchId;
    }

    return queryBranchId;
  }

  async revenueSummary(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const { totalRow, refundedRow } =
      await this.orderService.getRevenueSummaryRows({
        from,
        to,
        branchId,
      });
    const paymentBreakdown = await this.paymentService.getPaymentBreakdown({
      from,
      to,
      branchId,
    });

    return {
      from,
      to,
      branchId: branchId || null,
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

  async revenueDaily(
    query: { from?: string; to?: string; branchId?: string },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const rows = await this.orderService.getDailyRevenueRows({
      from,
      to,
      branchId,
    });

    return {
      from,
      to,
      branchId: branchId || null,
      data: rows.map((row) => ({
        day: row.day,
        orderCount: Number(row.orderCount),
        revenue: Number(row.revenue),
      })),
    };
  }

  async servingStats(query: { branchId?: string }, user?: ReportUser) {
    const branchId = this.resolveBranchId(query.branchId, user);
    const row = await this.orderService.getServingStatsRow({
      branchId,
    });

    return {
      branchId: branchId || null,
      servingOrders: Number(row?.servingOrders || 0),
      servingCustomers: Number(row?.servingCustomers || 0),
    };
  }

  async customerStats(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
      filter?: string;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveCustomerRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const { dailyRows, totalRow } =
      await this.orderService.getCustomerStatsRows({
        from,
        to,
        branchId,
      });

    return {
      filter: query.filter || null,
      from,
      to,
      branchId: branchId || null,
      totalCustomers: Number(totalRow?.count || 0),
      daily: dailyRows.map((row) => ({
        date: row.date,
        customers: Number(row.uniqueCustomers),
        orders: Number(row.totalOrders),
      })),
    };
  }

  async menuPerformance(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
      filter?: string;
      groupBy?: 'category' | 'type';
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveCustomerRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const groupBy = query.groupBy || 'category';
    const [averageRow, groupRows] = await Promise.all([
      this.orderItemService.getMenuAverageRows({
        from,
        to,
        branchId,
      }),
      this.orderItemService.getMenuPerformanceGroups({
        from,
        to,
        branchId,
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
      branchId: branchId || null,
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

  async cancellationReport(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
      filter?: string;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveCustomerRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const reportRows = await this.orderItemService.getCancellationReportRows({
      from,
      to,
      branchId,
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
      branchId: branchId || null,
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

  async employeeReport(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
      filter?: string;
      employeeId?: string;
      limit?: number;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveCustomerRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const reportQuery = {
      from,
      to,
      branchId,
      employeeId: query.employeeId,
    };

    const [salesRows, chartRows, cashierRows, profitRows] = await Promise.all([
      this.orderService.getEmployeeSalesRows(reportQuery),
      this.orderService.getEmployeeSalesRows({ ...reportQuery, limit }),
      this.orderItemService.getEmployeeCashierRows(reportQuery),
      this.orderItemService.getEmployeeProfitRows(reportQuery),
    ]);

    const sales = salesRows.map((row) => ({
      id: row.id,
      employee: row.employee,
      orders: Number(row.orders || 0),
      totalAmount: Number(row.totalAmount || 0),
      discount: Number(row.discount || 0),
      revenue: Number(row.revenue || 0),
    }));

    const cashier = cashierRows.map((row) => ({
      id: row.id,
      employee: row.employee,
      quantity: Number(row.quantity || 0),
      revenue: Number(row.revenue || 0),
    }));

    const profit = profitRows.map((row) => {
      const revenue = Number(row.revenue || 0);
      const cost = Number(row.cost || 0);

      return {
        id: row.id,
        employee: row.employee,
        totalPurchase: Number(row.totalPurchase || 0),
        discount: Number(row.discount || 0),
        revenue,
        cost,
        profit: revenue - cost,
      };
    });

    return {
      filter: query.filter || null,
      from,
      to,
      branchId: branchId || null,
      employeeId: query.employeeId || null,
      employees: sales.map((row) => ({
        id: row.id,
        code: null,
        name: row.employee,
        department: null,
        position: 'Thu ngân',
        workDays: 0,
        workHours: 0,
        overtime: 0,
        late: 0,
        absent: 0,
        salary: 0,
        performance: 0,
      })),
      chart: chartRows.map((row) => ({
        id: row.id,
        name: row.employee,
        revenue: Number(row.revenue || 0),
      })),
      sales,
      cashier,
      profit,
      summary: {
        orders: sales.reduce((sum, row) => sum + row.orders, 0),
        totalAmount: sales.reduce((sum, row) => sum + row.totalAmount, 0),
        discount: sales.reduce((sum, row) => sum + row.discount, 0),
        revenue: sales.reduce((sum, row) => sum + row.revenue, 0),
        quantity: cashier.reduce((sum, row) => sum + row.quantity, 0),
        cost: profit.reduce((sum, row) => sum + row.cost, 0),
        profit: profit.reduce((sum, row) => sum + row.profit, 0),
      },
    };
  }

  async topProducts(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
      limit?: number;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const rows = await this.orderItemService.getTopProducts({
      from,
      to,
      branchId,
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

  async stockSnapshot(branchId?: string, user?: ReportUser) {
    const resolvedBranchId = this.resolveBranchId(branchId, user);
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('stock_items', 'stockItem', 'stockItem.product_id = product.id')
      .leftJoin('stocks', 'stock', 'stock.id = stockItem.stock_id')
      .select('product.id', 'productId')
      .addSelect('product.name', 'name')
      .addSelect('product.unit', 'unit')
      .addSelect(
        'MAX(COALESCE(stockItem.updated_at, product.updated_at))',
        'updatedAt',
      )
      .where('product.is_active = :isActive', { isActive: true })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.unit')
      .orderBy('product.name', 'ASC');

    if (resolvedBranchId) {
      query
        .addSelect(
          'COALESCE(SUM(CASE WHEN stock.branch_id = :branchId THEN stockItem.quantity ELSE 0 END), 0)',
          'quantity',
        )
        .setParameter('branchId', resolvedBranchId);
    } else {
      query.addSelect('COALESCE(SUM(stockItem.quantity), 0)', 'quantity');
    }

    const rows = await query.getRawMany();

    return rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      unit: row.unit,
      quantity: Number(row.quantity || 0),
      updatedAt: row.updatedAt,
    }));
  }

  async bottomProducts(
    query: {
      from?: string;
      to?: string;
      branchId?: string;
      limit?: number;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const rows = await this.orderItemService.getBottomProducts({
      from,
      to,
      branchId,
      limit,
    });

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      totalQuantity: Number(row.totalQuantity),
      totalRevenue: Number(row.totalRevenue),
    }));
  }

  async endOfDay(
    query: { from?: string; to?: string; branchId?: string },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const rows = await this.orderItemService.getEndOfDayItems({
      from,
      to,
      branchId,
    });

    return {
      from,
      to,
      branchId: branchId || null,
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

  async monthlyOrderPlan(
    query: {
      from?: string;
      to?: string;
      month?: string;
      branchId?: string;
      minRate?: number;
      maxRate?: number;
    },
    user?: ReportUser,
  ) {
    const { from, to } = this.resolveMonthlyRange(query);
    const branchId = this.resolveBranchId(query.branchId, user);
    const minRate = Number(query.minRate || 1.2);
    const maxRate = Number(query.maxRate || 1.5);
    const [rows, revenueRows, stockRows] = await Promise.all([
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
      this.getStockOnHandByProduct(branchId),
    ]);
    const stockByProductId = new Map(
      stockRows.map((row) => [row.productId, Number(row.quantity || 0)]),
    );

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
        stockOnHand: true,
        usagePerMil: false,
      },
      data: rows.map((row, index) => {
        const monthlyUsage = Number(row.monthlyUsage || 0);
        const minPlan = Math.ceil(monthlyUsage * minRate);
        const maxPlan = Math.ceil(monthlyUsage * maxRate);
        const stockOnHand = stockByProductId.get(row.productId) || 0;

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
          suggestedOrderQuantity: Math.max(maxPlan - stockOnHand, 0),
          revenue: Number(row.revenue || 0),
        };
      }),
    };
  }

  async inventoryReport(branchId?: string, user?: ReportUser) {
    return this.stockSnapshot(branchId, user);
  }

  private safeAverage(total: number, quantity: number) {
    if (quantity <= 0) {
      return 0;
    }

    return Math.round(total / quantity);
  }

  private async getStockOnHandByProduct(branchId?: string) {
    const query = this.stockItemRepository
      .createQueryBuilder('stockItem')
      .innerJoin('stockItem.stock', 'stock')
      .select('stockItem.productId', 'productId')
      .addSelect('COALESCE(SUM(stockItem.quantity), 0)', 'quantity')
      .groupBy('stockItem.productId');

    if (branchId) {
      query.where('stock.branchId = :branchId', { branchId });
    }

    return query.getRawMany<{ productId: string; quantity: string }>();
  }
}
