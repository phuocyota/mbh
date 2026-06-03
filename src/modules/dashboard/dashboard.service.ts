import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, Customer } from '../../entities';

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

  async getRevenueStats(filter: string, branchId?: string) {
    const { from, to } = this.resolveDateRange(filter);
    
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select([
        'DATE(order.createdAt) as date',
        'EXTRACT(HOUR FROM order.createdAt) as hour',
        'COUNT(order.id) as orderCount',
        'SUM(order.totalAmount) as revenue',
      ])
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'RECEIVED', 'COMPLETED'] });
    
    if (branchId) {
      query.andWhere('order.branchId = :branchId', { branchId });
    }
    
    const hourlyData = await query
      .groupBy('DATE(order.createdAt)')
      .addGroupBy('EXTRACT(HOUR FROM order.createdAt)')
      .orderBy('date', 'ASC')
      .addOrderBy('hour', 'ASC')
      .getRawMany();
    
    const dailyData = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        'DATE(order.createdAt) as date',
        'COUNT(order.id) as orderCount',
        'SUM(order.totalAmount) as revenue',
      ])
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'RECEIVED', 'COMPLETED'] })
      .groupBy('DATE(order.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
    
    const summary = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        'COUNT(order.id) as totalOrders',
        'SUM(order.totalAmount) as totalRevenue',
      ])
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'RECEIVED', 'COMPLETED'] })
      .getRawOne();

    return {
      filter,
      from,
      to,
      summary: {
        orders: Number(summary?.totalOrders || 0),
        revenue: Number(summary?.totalRevenue || 0),
      },
      hourly: hourlyData.map(row => ({
        date: row.date,
        hour: Number(row.hour),
        orders: Number(row.orderCount),
        revenue: Number(row.revenue),
      })),
      daily: dailyData.map(row => ({
        date: row.date,
        orders: Number(row.orderCount),
        revenue: Number(row.revenue),
      })),
    };
  }

  async getCustomerStats(filter: string, branchId?: string) {
    const { from, to } = this.resolveDateRange(filter);
    
    const query = this.orderRepository
      .createQueryBuilder('order')
      .select([
        'DATE(order.createdAt) as date',
        'COUNT(DISTINCT order.customerId) as uniqueCustomers',
        'COUNT(order.id) as totalOrders',
      ])
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'RECEIVED', 'COMPLETED'] });
    
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
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('order.status IN (:...statuses)', { statuses: ['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'RECEIVED', 'COMPLETED'] })
      .getRawOne();

    return {
      filter,
      from,
      to,
      totalCustomers: Number(totalUnique?.count || 0),
      daily: dailyCustomers.map(row => ({
        date: row.date,
        customers: Number(row.uniqueCustomers),
        orders: Number(row.totalOrders),
      })),
    };
  }
}
