import { ApiProperty } from '@nestjs/swagger';

export class UserHomeDto {
  @ApiProperty({ description: 'User ID', example: 'student_5000' })
  id: string;

  @ApiProperty({ description: 'Full name', example: 'Test Student 5000' })
  fullName: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://be.kidocanteen.kidoedu.vn/uploads/avatar.jpg',
    nullable: true,
  })
  avatarUrl: string | null;
}

export class WalletHomeDto {
  @ApiProperty({ description: 'Wallet balance', example: 45000 })
  balance: number;
}

export class NotificationHomeDto {
  @ApiProperty({ description: 'Notification ID', example: 'noti_001' })
  id: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Con đã đặt món Cơm gà',
  })
  message: string;

  @ApiProperty({ description: 'Notification type', example: 'ORDER_RECEIVED' })
  type: string;

  @ApiProperty({
    description: 'Amount (if applicable)',
    example: -30000,
    nullable: true,
  })
  amount: number | null;

  @ApiProperty({ description: 'Is read', example: false })
  isRead: boolean;

  @ApiProperty({
    description: 'Created at',
    example: '2026-05-27T10:30:00+07:00',
  })
  createdAt: string;
}

export class OrderItemHomeDto {
  @ApiProperty({ description: 'Item ID', example: 'item_001' })
  id: string;

  @ApiProperty({ description: 'Product name', example: 'Cơm gà' })
  name: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  quantity: number;

  @ApiProperty({ description: 'Unit price', example: 15000 })
  unitPrice: number;

  @ApiProperty({ description: 'Total price', example: 30000 })
  totalPrice: number;
}

export class OrderAddonHomeDto {
  @ApiProperty({ description: 'Addon ID', example: 'addon_001' })
  id: string;

  @ApiProperty({ description: 'Addon name', example: 'Sữa' })
  name: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  quantity: number;

  @ApiProperty({ description: 'Price', example: 0 })
  price: number;
}

export class TodayOrderHomeDto {
  @ApiProperty({ description: 'Order ID', example: 'order_001' })
  id: string;

  @ApiProperty({ description: 'Order status code', example: 1 })
  status: number;

  @ApiProperty({ description: 'Status text', example: 'Đang chuẩn bị' })
  statusText: string;

  @ApiProperty({
    description: 'Ordered at',
    example: '2026-05-27T09:45:00+07:00',
  })
  orderedAt: string;

  @ApiProperty({ description: 'Order items', type: [OrderItemHomeDto] })
  items: OrderItemHomeDto[];

  @ApiProperty({ description: 'Order addons', type: [OrderAddonHomeDto] })
  addons: OrderAddonHomeDto[];

  @ApiProperty({ description: 'Total amount', example: 30000 })
  totalAmount: number;
}

export class RecentHistoryHomeDto {
  @ApiProperty({ description: 'Order ID', example: 'order_001' })
  id: string;

  @ApiProperty({ description: 'Transaction type', example: 'ORDER_PAYMENT' })
  type: string;

  @ApiProperty({ description: 'Transaction title', example: 'Cơm gà' })
  title: string;

  @ApiProperty({ description: 'Amount', example: -30000 })
  amount: number;

  @ApiProperty({ description: 'Order status code', example: 1 })
  status: number;

  @ApiProperty({ description: 'Status text', example: 'Đang chuẩn bị' })
  statusText: string;

  @ApiProperty({
    description: 'Created at',
    example: '2026-05-27T10:30:00+07:00',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'order_001',
    nullable: true,
  })
  orderId: string | null;
}

export class StatisticsPeriodHomeDto {
  @ApiProperty({ description: 'Spent amount', example: 150000 })
  spent: number;

  @ApiProperty({ description: 'Limit amount', example: 200000 })
  limit: number;
}

export class StatisticsHomeDto {
  @ApiProperty({
    description: 'Week statistics',
    type: StatisticsPeriodHomeDto,
  })
  week: StatisticsPeriodHomeDto;

  @ApiProperty({
    description: 'Month statistics',
    type: StatisticsPeriodHomeDto,
  })
  month: StatisticsPeriodHomeDto;
}

export class ParentHomeResponseDto {
  @ApiProperty({ description: 'User info', type: UserHomeDto })
  user: UserHomeDto;

  @ApiProperty({ description: 'Wallet info', type: WalletHomeDto })
  wallet: WalletHomeDto;

  @ApiProperty({
    description: 'Recent notifications',
    type: [NotificationHomeDto],
  })
  notifications: NotificationHomeDto[];

  @ApiProperty({
    description: 'Today order',
    type: TodayOrderHomeDto,
    nullable: true,
  })
  todayOrder: TodayOrderHomeDto | null;

  @ApiProperty({ description: 'Recent history', type: [RecentHistoryHomeDto] })
  recentHistory: RecentHistoryHomeDto[];

  @ApiProperty({ description: 'Statistics', type: StatisticsHomeDto })
  statistics: StatisticsHomeDto;
}
