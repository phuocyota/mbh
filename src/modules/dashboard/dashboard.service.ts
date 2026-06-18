import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, Customer, WarehouseVoucher, WorkSchedule } from '../../entities';
import {
  ORDER_PAYMENT_STATUS,
  REVENUE_ORDER_STATUSES,
} from '../../common/constant/constant';

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(WarehouseVoucher)
    private warehouseVoucherRepository: Repository<WarehouseVoucher>,
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
  ) {}

  private resolveDateRange(filter: string): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let to = new Date(today);
    to.setHours(23, 59, 59, 999);
    
    let from = new Date(today);
    from.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'today':
        break;
      case 'yesterday':
        from.setDate(from.getDate() - 1);
        to.setDate(to.getDate() - 1);
        break;
      case '7days':
        from.setDate(from.getDate() - 6);
        break;
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        to.setHours(23, 59, 59, 999);
        break;
      default:
        from.setDate(from.getDate() - 6); // default 7 days
    }

    return { from, to };
  }

  async getCustomerStats(filter: string, branchId?: string) {
    const range = this.resolveDateRange(filter);
    
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select([
        'DATE(order.createdAt) as date',
        'COUNT(DISTINCT order.customerId) as uniqueCustomers',
        'COUNT(order.id) as totalOrders',
      ])
      .where('order.createdAt BETWEEN :from AND :to', range)
      .andWhere('order.paymentStatus = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('order.status IN (:...statuses)', {
        statuses: REVENUE_ORDER_STATUSES,
      });
    
    if (branchId) {
      query.andWhere('order.branchId = :branchId', { branchId });
    }
    
    const dailyCustomers = await query
      .groupBy('DATE(order.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    const totalUnique = await this.orderRepository
      .createQueryBuilder('order')
      .select('COUNT(DISTINCT order.customerId)', 'count')
      .where('order.createdAt BETWEEN :from AND :to', range)
      .andWhere('order.paymentStatus = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('order.status IN (:...statuses)', {
        statuses: REVENUE_ORDER_STATUSES,
      });

    if (branchId) {
      totalUnique.andWhere('order.branchId = :branchId', { branchId });
    }

    const totalUniqueRow = await totalUnique
      .getRawOne();

    return {
      filter,
      from: range.from,
      to: range.to,
      totalCustomers: Number(totalUniqueRow?.count || 0),
      daily: dailyCustomers.map(row => ({
        date: row.date,
        customers: Number(row.uniqueCustomers),
        orders: Number(row.totalOrders),
      })),
    };
  }

  async getRevenueStats(filter: string, branchId?: string) {
    const range = this.resolveDateRange(filter);

    const query = this.orderRepository
      .createQueryBuilder('order')
      .select([
        'DATE(order.createdAt) as date',
        'COUNT(order.id) as orderCount',
        'COALESCE(SUM(order.totalAmount), 0) as revenue',
      ])
      .where('order.createdAt BETWEEN :from AND :to', range)
      .andWhere('order.paymentStatus = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('order.status IN (:...statuses)', {
        statuses: REVENUE_ORDER_STATUSES,
      });

    if (branchId) {
      query.andWhere('order.branchId = :branchId', { branchId });
    }

    const daily = await query
      .groupBy('DATE(order.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    const totalRevenue = daily.reduce(
      (sum, row) => sum + Number(row.revenue || 0),
      0,
    );
    const orderCount = daily.reduce(
      (sum, row) => sum + Number(row.orderCount || 0),
      0,
    );

    return {
      filter,
      from: range.from,
      to: range.to,
      branchId: branchId || null,
      totalRevenue,
      orderCount,
      daily: daily.map((row) => ({
        date: row.date,
        orderCount: Number(row.orderCount || 0),
        revenue: Number(row.revenue || 0),
      })),
    };
  }

  async getRecentActivities(limit = 10, branchId?: string) {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const orderQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.cashier', 'cashier')
      .select([
        "'sale' as type",
        'order.id as id',
        'order.orderCode as code',
        'order.totalAmount as amount',
        'order.createdAt as "createdAt"',
        "COALESCE(cashier.fullName, 'Nhân viên') as actor",
      ])
      .where('order.paymentStatus = :paymentStatus', {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
      })
      .andWhere('order.status IN (:...statuses)', {
        statuses: REVENUE_ORDER_STATUSES,
      });

    if (branchId) {
      orderQuery.andWhere('order.branchId = :branchId', { branchId });
    }

    const voucherQuery = this.warehouseVoucherRepository
      .createQueryBuilder('voucher')
      .leftJoin('voucher.supplier', 'supplier')
      .select([
        "'import' as type",
        'voucher.id as id',
        'voucher.code as code',
        'voucher.totalAmount as amount',
        'voucher.createdAt as "createdAt"',
        "COALESCE(supplier.name, 'Kho') as actor",
      ])
      .where('voucher.type = :type', { type: 'IMPORT' });

    if (branchId) {
      voucherQuery.andWhere('voucher.branchId = :branchId', { branchId });
    }

    const [orders, vouchers] = await Promise.all([
      orderQuery.orderBy('order.createdAt', 'DESC').limit(normalizedLimit).getRawMany(),
      voucherQuery
        .orderBy('voucher.createdAt', 'DESC')
        .limit(normalizedLimit)
        .getRawMany(),
    ]);

    return [...orders, ...vouchers]
      .map((item) => ({
        type: item.type,
        id: item.id,
        code: item.code,
        actor: item.actor,
        amount: Number(item.amount || 0),
        createdAt: item.createdAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, normalizedLimit);
  }

  async getEmployeeAttendance(filter: string) {
    const range = this.resolveDateRange(filter);
    const fromDate = range.from.toISOString().slice(0, 10);
    const toDate = range.to.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const records = await this.workScheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.employee', 'employee')
      .where('schedule.workDate BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      })
      .getMany();

    const employeeMap = new Map<
      string,
      { employeeId: string; name: string; hours: number; worksToday: boolean }
    >();

    for (const record of records) {
      const existing = employeeMap.get(record.employeeId) || {
        employeeId: record.employeeId,
        name: record.employee?.fullName || 'Nhân viên',
        hours: 0,
        worksToday: false,
      };

      existing.hours += this.getShiftHours(record.shift);
      existing.worksToday = existing.worksToday || record.workDate === today;
      employeeMap.set(record.employeeId, existing);
    }

    const employees = Array.from(employeeMap.values());
    const topStaffs = employees
      .filter((employee) => employee.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
      .map((employee) => ({
        employeeId: employee.employeeId,
        name: employee.name,
        hours: employee.hours,
        hoursFormatted: this.formatHours(employee.hours),
      }));

    return {
      filter,
      from: range.from,
      to: range.to,
      summary: {
        working: employees.filter((employee) => employee.worksToday).length,
        absent: 0,
        pendingRequests: 0,
        late: 0,
        earlyLeave: 0,
        overtime: employees.filter((employee) => employee.hours > 8).length,
      },
      topStaffs,
    };
  }

  private getShiftHours(shift: string) {
    switch (shift) {
      case 'morning':
      case 'afternoon':
        return 4;
      case 'full':
        return 8;
      default:
        return 0;
    }
  }

  private formatHours(hours: number) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes > 0
      ? `${wholeHours} giờ ${minutes} phút`
      : `${wholeHours} giờ`;
  }
}
