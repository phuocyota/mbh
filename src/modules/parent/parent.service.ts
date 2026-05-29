import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import {
  ParentHomeResponseDto,
  UserHomeDto,
  WalletHomeDto,
  NotificationHomeDto,
  TodayOrderHomeDto,
  OrderItemHomeDto,
  OrderAddonHomeDto,
  RecentHistoryHomeDto,
  StatisticsHomeDto,
  StatisticsPeriodHomeDto,
} from './dto/parent-home-response.dto';

// Order status mapping to text
const ORDER_STATUS_TEXT: Record<string, string> = {
  PENDING: 'Cho xac nhan',
  PREPARING: 'Dang chuan bi',
  READY: 'San sang',
  READY_TO_PICKUP: 'San sang lay',
  DONE: 'Hoan thanh',
  RECEIVED: 'Da nhan',
  CANCELLED: 'Da huy',
};

// Transaction status mapping to text
const TRANSACTION_STATUS_TEXT: Record<string, string> = {
  PENDING: 'Cho xu ly',
  COMPLETED: 'Hoan thanh',
  FAILED: 'That bai',
  REFUNDED: 'Da hoan tien',
};

// Transaction type mapping to title
const TRANSACTION_TYPE_TITLE: Record<string, string> = {
  PAYMENT: 'Thanh toan don hang',
  TOPUP: 'Nap tien',
  REFUND: 'Hoan tien',
  ADJUSTMENT: 'Dieu chinh',
};

@Injectable()
export class ParentService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getParentHome(userId: string): Promise<ParentHomeResponseDto> {
    // Find customer by userId
    const customer = await this.customerRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found for this user');
    }

    const [
      userDto,
      walletDto,
      notifications,
      todayOrder,
      recentHistory,
      statistics,
    ] = await Promise.all([
      this.getUserInfo(customer),
      this.getWalletInfo(customer.id),
      this.getRecentNotifications(customer.id),
      this.getTodayOrder(customer.id),
      this.getRecentHistory(customer.id),
      this.getStatistics(customer.id, Number(customer.spendingLimit || 0)),
    ]);

    return {
      user: userDto,
      wallet: walletDto,
      notifications,
      todayOrder,
      recentHistory,
      statistics,
    };
  }

  private async getUserInfo(customer: Customer): Promise<UserHomeDto> {
    const user = await this.userRepository.findOne({
      where: { id: customer.userId },
    });

    return {
      id: customer.id,
      fullName: customer.fullName,
      avatarUrl: user?.avatar || null,
    };
  }

  private async getWalletInfo(customerId: string): Promise<WalletHomeDto> {
    const wallet = await this.walletRepository.findOne({
      where: { customerId },
    });

    return {
      balance: wallet ? Number(wallet.balance) : 0,
    };
  }

  private async getRecentNotifications(
    customerId: string,
  ): Promise<NotificationHomeDto[]> {
    const notifications = await this.notificationRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return notifications.map((n) => ({
      id: n.id,
      message: n.message,
      type: n.type,
      amount:
        n.amount === null || n.amount === undefined ? null : Number(n.amount),
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  private async getTodayOrder(
    customerId: string,
  ): Promise<TodayOrderHomeDto | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const order = await this.orderRepository.findOne({
      where: {
        customerId,
        createdAt: Between(today, tomorrow),
      },
      order: { createdAt: 'DESC' },
      relations: ['items'],
    });

    if (!order) {
      return null;
    }

    // Map order items
    const items: OrderItemHomeDto[] = order.items
      ? order.items
          .filter((item: OrderItem) => item.status !== 'CANCELLED')
          .map((item: OrderItem) => ({
            id: item.id,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalAmount),
          }))
      : [];

    // For now, addons are empty - can be extended later
    const addons: OrderAddonHomeDto[] = [];
    const normalizedStatus = this.normalizeOrderStatus(order.status);

    return {
      id: order.id,
      status: normalizedStatus,
      statusText: ORDER_STATUS_TEXT[normalizedStatus] || normalizedStatus,
      orderedAt: order.createdAt.toISOString(),
      items,
      addons,
      totalAmount: Number(order.totalAmount || 0),
    };
  }

  private normalizeOrderStatus(status: string): string {
    const statusMap: Record<string, string> = {
      Pending: 'PENDING',
      PREPARING: 'PREPARING',
      READY_TO_PICKUP: 'READY',
      DONE: 'RECEIVED',
      CANCELLED: 'CANCELLED',
      DRAFT: 'PENDING',
    };
    return statusMap[status] || status.toUpperCase();
  }

  private async getRecentHistory(
    customerId: string,
  ): Promise<RecentHistoryHomeDto[]> {
    const transactions = await this.walletTransactionRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return transactions.map((t) => ({
      id: t.id,
      type: this.mapTransactionType(t.type),
      title: this.getTransactionTitle(t),
      amount: Number(t.amount) * (t.type === 'PAYMENT' ? -1 : 1),
      status: 'COMPLETED',
      statusText: TRANSACTION_STATUS_TEXT['COMPLETED'],
      createdAt: t.createdAt.toISOString(),
      orderId: t.refType === 'ORDER' ? t.refId : null,
    }));
  }

  private mapTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      PAYMENT: 'ORDER_PAYMENT',
      TOPUP: 'TOPUP',
      REFUND: 'REFUND',
      ADJUSTMENT: 'REFUND',
    };
    return typeMap[type] || type;
  }

  private getTransactionTitle(transaction: WalletTransaction): string {
    if (transaction.note) {
      return transaction.note;
    }
    return TRANSACTION_TYPE_TITLE[transaction.type] || transaction.type;
  }

  private async getStatistics(
    customerId: string,
    spendingLimit: number,
  ): Promise<StatisticsHomeDto> {
    const now = new Date();
    const weekStart = new Date(now);
    const daysSinceMonday = (now.getDay() + 6) % 7;
    weekStart.setDate(now.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [weekSpent, monthSpent] = await Promise.all([
      this.calculateSpentInPeriod(customerId, weekStart, weekEnd),
      this.calculateSpentInPeriod(customerId, monthStart, monthEnd),
    ]);

    return {
      week: {
        spent: weekSpent,
        limit: spendingLimit,
      },
      month: {
        spent: monthSpent,
        limit: spendingLimit,
      },
    };
  }

  private async calculateSpentInPeriod(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const transactions = await this.walletTransactionRepository.find({
      where: {
        customerId,
        type: 'PAYMENT',
        createdAt: Between(startDate, endDate),
      },
    });

    return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }
}
