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
import {
  ORDER_STATUS,
  WALLET_TRANSACTION_TYPE,
} from '../../common/constant/constant';

const ORDER_STATUS_TEXT: Record<number, string> = {
  [ORDER_STATUS.CANCELLED]: 'Đã hủy',
  [ORDER_STATUS.PREPARING]: 'Đang chuẩn bị',
  [ORDER_STATUS.PENDING]: 'Chờ xác nhận',
  [ORDER_STATUS.PENDING_PAYMENT]: 'Đợi thu tiền mặt',
  [ORDER_STATUS.READY_TO_PICKUP]: 'Sẵn sàng lấy',
  [ORDER_STATUS.DONE]: 'Hoàn thành',
  [ORDER_STATUS.REFUNDED]: 'Đã hoàn tiền',
  [ORDER_STATUS.DRAFT]: 'Nháp',
  [ORDER_STATUS.WAITING]: 'Đang chờ',
  [ORDER_STATUS.READY]: 'Sẵn sàng',
  [ORDER_STATUS.RECEIVED]: 'Đã nhận',
  [ORDER_STATUS.COMPLETED]: 'Hoàn tất',
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
      this.getStatistics(customer.id, Number(customer.debtLimit || 0)),
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

    const activeItems = (order.items || []).filter(
      (item: OrderItem) => item.status !== 'CANCELLED',
    );
    const items: OrderItemHomeDto[] = activeItems
      .filter((item: OrderItem) => Number(item.unitPrice) > 0)
      .map((item: OrderItem) => ({
        id: item.id,
        name: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalAmount),
      }));

    const addons: OrderAddonHomeDto[] = activeItems
      .filter((item: OrderItem) => Number(item.unitPrice) === 0)
      .map((item: OrderItem) => ({
        id: item.id,
        name: item.productName,
        quantity: item.quantity,
        price: Number(item.totalAmount || 0),
      }));
    const normalizedStatus = this.normalizeOrderStatus(order.status);

    return {
      id: order.id,
      status: normalizedStatus,
      statusText:
        ORDER_STATUS_TEXT[normalizedStatus] || String(normalizedStatus),
      orderedAt: order.createdAt.toISOString(),
      items,
      addons,
      totalAmount: Number(order.totalAmount || 0),
    };
  }

  private normalizeOrderStatus(status: number): number {
    const statusMap: Record<number, number> = {
      [ORDER_STATUS.READY_TO_PICKUP]: ORDER_STATUS.READY,
      [ORDER_STATUS.DONE]: ORDER_STATUS.RECEIVED,
      [ORDER_STATUS.DRAFT]: ORDER_STATUS.PENDING,
    };
    return statusMap[status] ?? status;
  }

  private async getRecentHistory(
    customerId: string,
  ): Promise<RecentHistoryHomeDto[]> {
    const orders = await this.orderRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      relations: ['items'],
      take: 3,
    });

    return orders.map((order) => ({
      id: order.id,
      type: 'ORDER_PAYMENT',
      title: this.getOrderTitle(order),
      amount: -Number(order.totalAmount || 0),
      status: this.normalizeOrderStatus(order.status),
      statusText:
        ORDER_STATUS_TEXT[this.normalizeOrderStatus(order.status)] ||
        String(order.status),
      createdAt: order.createdAt.toISOString(),
      orderId: order.id,
    }));
  }

  private getOrderTitle(order: Order): string {
    const items = (order.items || []).filter(
      (item: OrderItem) => item.status !== 'CANCELLED',
    );

    if (!items.length) {
      return order.orderCode || 'Don hang';
    }

    const firstItemName = items[0].productName;
    const remainingCount = items.length - 1;

    return remainingCount > 0
      ? `${firstItemName} + ${remainingCount} mon`
      : firstItemName;
  }

  private async getStatistics(
    customerId: string,
    debtLimit: number,
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
        limit: debtLimit,
      },
      month: {
        spent: monthSpent,
        limit: debtLimit,
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
        type: WALLET_TRANSACTION_TYPE.PAYMENT,
        createdAt: Between(startDate, endDate),
      },
    });

    return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }
}
