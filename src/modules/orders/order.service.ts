import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from 'src/entities';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { OrderNumberService } from './order-number.service';
import { CouponService } from '../coupon/coupon.service';
import { OrderItemService } from '../order-item/order-item.service';
import { PaymentService } from '../payment/payment.service';
import { WalletService } from '../wallet/wallet.service';
import { CustomerService } from '../customer/customer.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private orderNumberService: OrderNumberService,
    private orderItemService: OrderItemService,
    private paymentService: PaymentService,
    private walletService: WalletService,
    private customerService: CustomerService,
    private couponService: CouponService,
  ) {}

  async createOrder(createOrderDto: any) {
    const orderCode = `ORD${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const orderNumber = await this.orderNumberService.generateNextOrderNumber();

    const items = Array.isArray(createOrderDto.items)
      ? createOrderDto.items.map((item: any) => {
          const unitPrice = Number(item.unitPrice);
          const quantity = Number(item.quantity);
          const discountAmount = Number(item.discountAmount ?? 0);
          const itemSubtotal = unitPrice * quantity;
          const itemTotalAmount = itemSubtotal - discountAmount;

          if (
            !item.productId ||
            !item.productName ||
            !Number.isFinite(unitPrice) ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(discountAmount) ||
            !Number.isFinite(itemSubtotal) ||
            !Number.isFinite(itemTotalAmount)
          ) {
            throw new BadRequestException('Invalid order item');
          }

          return {
            productId: item.productId,
            productName: item.productName,
            unitPrice,
            quantity,
            subtotal: itemSubtotal,
            discountAmount,
            totalAmount: itemTotalAmount,
            note: item.note,
          };
        })
      : [];

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.subtotal,
      0,
    );
    const discount = items.reduce(
      (sum: number, item: any) => sum + item.discountAmount,
      0,
    );
    const totalAmount = subtotal - discount;

    const order = this.orderRepository.create({
      ...createOrderDto,
      items: undefined,
      orderCode: orderCode,
      orderNumber: orderNumber,
      status: 'Pending',
      paymentStatus: 'UNPAID',
      paymentMethod: createOrderDto.paymentMethod ?? null,
      subtotal,
      totalAmount,
    });

    const savedResult = await this.orderRepository.save(order);
    const savedOrder = Array.isArray(savedResult)
      ? savedResult[0]
      : savedResult;

    // Create order items if provided
    if (items.length > 0) {
      await this.orderItemService.createManyForOrder(savedOrder.id, items);
    }

    return this.getOrderWithItems(savedOrder.id);
  }

  async findOrderByIdOrThrow(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    return order;
  }

  async markRefunded(
    orderId: string,
    isFullRefund: boolean,
    updatedBy: string,
  ): Promise<void> {
    const order = await this.findOrderByIdOrThrow(orderId);

    await this.orderRepository.update(order.id, {
      paymentStatus: 'REFUNDED',
      status: isFullRefund ? 'REFUNDED' : order.status,
      updatedBy,
    });
  }

  async addItemToOrder(orderId: string, createOrderItemDto: any) {
    const item = await this.orderItemService.createForOrder(
      orderId,
      createOrderItemDto,
    );

    // Update order totals
    await this.recalculateOrderTotals(orderId);

    return item;
  }

  async recalculateOrderTotals(orderId: string) {
    const items = await this.orderItemService.findNormalByOrder(orderId);

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );
    const discount = items.reduce(
      (sum, item) => sum + Number(item.discountAmount),
      0,
    );
    const total = subtotal - discount;

    await this.orderRepository.update(orderId, {
      subtotal,
      discountAmount: discount,
      totalAmount: total,
    });
  }

  async processPayment(orderId: string, paymentDto: any) {
    const order = await this.findOrderByIdOrThrow(orderId);

    let couponDiscount = 0;
    let couponId: string | null = null;
    let remainingAmount = Number(paymentDto.amount || 0);

    // Step 1: Apply coupon discount first if provided
    if (paymentDto.couponId && paymentDto.customerId) {
      const coupon = await this.couponService.useCoupon(
        paymentDto.couponId,
        paymentDto.customerId,
      );

      couponDiscount = Number(coupon.reducePrice);
      couponId = paymentDto.couponId;

      // Reduce the amount to be paid by coupon discount
      remainingAmount = Math.max(0, remainingAmount - couponDiscount);
    }

    // Step 2: Handle wallet payment for remaining amount
    if (remainingAmount > 0 && paymentDto.method === 'WALLET') {
      if (!paymentDto.customerId) {
        throw new BadRequestException(
          'Customer is required for wallet payment',
        );
      }

      await this.walletService.chargeForOrder(
        paymentDto.customerId,
        remainingAmount,
        orderId,
      );
    }

    const payment = await this.paymentService.createSuccessPayment({
      ...paymentDto,
      orderId: orderId,
    });

    // Update order status with coupon information
    const paidAmount =
      Number(order.paidAmount || 0) + Number(paymentDto.amount || 0);
    const totalAmount = Number(order.totalAmount || 0);
    const isPaid = paidAmount >= totalAmount;

    const updateData: any = {
      paidAmount: paidAmount,
      changeAmount: paidAmount - totalAmount,
      paymentStatus: isPaid ? 'PAID' : 'PARTIAL',
      paymentMethod: paymentDto.method,
      status: isPaid ? 'PREPARING' : 'DRAFT',
      paidAt: isPaid ? new Date() : undefined,
    };

    if (couponId) {
      updateData.couponId = couponId;
      updateData.couponDiscount = couponDiscount;
    }

    await this.orderRepository.update(orderId, updateData);

    return payment;
  }

  async completeOrder(orderId: string) {
    const order = await this.findOrderByIdOrThrow(orderId);

    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Order must be fully paid before completion',
      );
    }

    await this.orderRepository.update(orderId, {
      status: 'DONE',
      completedAt: new Date(),
    });

    return this.getOrderWithItems(orderId);
  }

  async confirmReceivedByCustomer(orderId: string, userId: string) {
    if (!userId) {
      throw new BadRequestException('User is required');
    }

    const order = await this.findOrderByIdOrThrow(orderId);

    const customer = await this.customerService.findByUserId(userId);
    if (!customer || order.customerId !== customer.id) {
      throw new BadRequestException('Order does not belong to this customer');
    }

    return this.completeOrder(orderId);
  }

  async confirmReceivedByCashier(orderId: string) {
    return this.completeOrder(orderId);
  }

  async getOrderWithItems(orderId: string) {
    return this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'payments', 'customer'],
    });
  }

  async findAll(branchId?: string, status?: string) {
    const query = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.customer', 'customer')
      .orderBy('o.created_at', 'DESC');

    if (branchId) {
      query.where('o.branch_id = :branchId', { branchId });
    }

    if (status) {
      query.andWhere('o.status = :status', { status });
    }

    return query.getMany();
  }

  async getRevenueSummaryRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const orderQb = this.orderRepository
      .createQueryBuilder('o')
      .where('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
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

    const refundQb = this.orderRepository
      .createQueryBuilder('o')
      .where('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere("o.payment_status = 'REFUNDED'");
    if (query.branchId) {
      refundQb.andWhere('o.branch_id = :branchId', {
        branchId: query.branchId,
      });
    }

    const refundedRow = await refundQb
      .select('COUNT(o.id)', 'refundCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'refundAmount')
      .getRawOne<{ refundCount: string; refundAmount: string }>();

    return { totalRow, refundedRow };
  }

  async getDailyRevenueRows(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .select("TO_CHAR(o.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(o.id)', 'orderCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere("o.status IN ('PAID','COMPLETED')")
      .groupBy('day')
      .orderBy('day', 'ASC');

    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', { branchId: query.branchId });
    }

    return qb.getRawMany<{
      day: string;
      orderCount: string;
      revenue: string;
    }>();
  }

  async getShiftOrderAggregate(query: {
    cashierId: string;
    branchId: string;
    from: Date;
    to: Date;
  }) {
    return this.orderRepository
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'orderCount')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalRevenue')
      .where('o.cashier_id = :cashierId', { cashierId: query.cashierId })
      .andWhere('o.branch_id = :branchId', { branchId: query.branchId })
      .andWhere('o.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere("o.status IN ('PAID','COMPLETED')")
      .getRawOne<{ orderCount: string; totalRevenue: string }>();
  }

  async findPendingCashOrders(branchId?: string) {
    return this.findAll(branchId, 'PENDING_PAYMENT');
  }

  async findPreparingOrders(branchId?: string) {
    return this.findAll(branchId, 'PREPARING');
  }

  async findReadyToPickupOrders(branchId?: string) {
    return this.findAll(branchId, 'READY_TO_PICKUP');
  }

  async receiveCashPayment(
    orderId: string,
    paymentDto: { amount: number; createdBy?: string },
  ) {
    const order = await this.findOrderByIdOrThrow(orderId);

    if (order.paymentStatus !== 'UNPAID') {
      throw new BadRequestException('Order payment must be in UNPAID status');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Order status must be PENDING_PAYMENT');
    }

    // Create payment record
    await this.paymentService.createSuccessPayment({
      orderId: orderId,
      method: 'CASH',
      amount: Number(paymentDto.amount),
    });

    // Update order: set paymentStatus to PAID and status to READY_TO_PICKUP
    await this.orderRepository.update(orderId, {
      paymentStatus: 'PAID',
      status: 'READY_TO_PICKUP',
      paidAmount: paymentDto.amount,
      paidAt: new Date(),
    });

    return this.getOrderWithItems(orderId);
  }

  async updateStatus(orderId: string, status: string) {
    await this.findOrderByIdOrThrow(orderId);

    await this.orderRepository.update(orderId, {
      status,
      updatedAt: new Date(),
    });

    return this.getOrderWithItems(orderId);
  }

  async cancelOrder(
    orderId: string,
    dto?: { reason?: string; isRefunded?: boolean },
  ) {
    const order = await this.findOrderByIdOrThrow(orderId);

    if (['DONE'].includes(order.status)) {
      throw new Error('Cannot cancel completed orders');
    }

    await this.orderRepository.update(orderId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    // Return order with cancel info (for FE compatibility)
    const updatedOrder = await this.getOrderWithItems(orderId);
    return {
      ...updatedOrder,
      isRefunded: dto?.isRefunded ?? true,
      cancelReason: dto?.reason ?? 'Không có lý do',
    };
  }

  async deleteOrder(orderId: string) {
    await this.findOrderByIdOrThrow(orderId);

    // Delete order items first (if cascade not set)
    await this.orderItemService.deleteByOrder(orderId);

    // Delete order
    await this.orderRepository.delete(orderId);

    return { message: 'Order deleted successfully' };
  }
}
