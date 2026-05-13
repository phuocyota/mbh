import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  Order,
  OrderItem,
  Payment,
  Wallet,
  WalletTransaction,
  Customer,
  Coupon,
} from 'src/entities';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { OrderNumberService } from './order-number.service';
import { CouponService } from '../coupon/coupon.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
    private orderNumberService: OrderNumberService,
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

    const subtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    const discount = items.reduce((sum: number, item: any) => sum + item.discountAmount, 0);
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
    const savedOrder = Array.isArray(savedResult) ? savedResult[0] : savedResult;

    // Create order items if provided
    if (items.length > 0) {
      for (const item of items) {
        const orderItem = this.orderItemRepository.create({
          ...item,
          orderId: savedOrder.id,
          status: 'NORMAL',
        });
        await this.orderItemRepository.save(orderItem);
      }
    }

    return this.getOrderWithItems(savedOrder.id);
  }

  async addItemToOrder(orderId: string, createOrderItemDto: any) {
    const orderItem = this.orderItemRepository.create({
      ...createOrderItemDto,
      orderId: orderId,
      status: 'NORMAL',
    });

    const item = await this.orderItemRepository.save(orderItem);

    // Update order totals
    await this.recalculateOrderTotals(orderId);

    return item;
  }

  async recalculateOrderTotals(orderId: string) {
    const items = await this.orderItemRepository.find({
      where: { orderId: orderId, status: 'NORMAL' },
    });

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
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    let couponDiscount = 0;
    let couponId: string | null = null;
    let remainingAmount = Number(paymentDto.amount || 0);

    // Step 1: Apply coupon discount first if provided
    if (paymentDto.couponId && paymentDto.customerId) {
      const coupon = await this.couponService.validateAndUseCoupon(
        paymentDto.couponId,
        paymentDto.customerId,
      );

      couponDiscount = Number(coupon.reducePrice);
      couponId = paymentDto.couponId;

      // Use the coupon
      const newUsedQuantity = coupon.usedQuantity + 1;
      const isFullyUsed = newUsedQuantity >= coupon.quantity;
      await this.couponRepository.update(paymentDto.couponId, {
        usedQuantity: newUsedQuantity,
        status: isFullyUsed ? 'USED' : 'ACTIVE',
      });

      // Reduce the amount to be paid by coupon discount
      remainingAmount = Math.max(0, remainingAmount - couponDiscount);
    }

    // Step 2: Handle wallet payment for remaining amount
    if (remainingAmount > 0 && paymentDto.method === 'WALLET') {
      if (!paymentDto.customerId) {
        throw new BadRequestException('Customer is required for wallet payment');
      }

      const wallet = await this.walletRepository.findOne({
        where: { customerId: paymentDto.customerId },
      });

      if (!wallet) {
        throw new BadRequestException('Customer wallet not found');
      }
      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Wallet is not active');
      }
      if (Number(wallet.balance) < remainingAmount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newBalance = Number(wallet.balance) - remainingAmount;
      await this.walletRepository.update(wallet.id, { balance: newBalance });

      // Log transaction
      const txId = uuid();
      const walletTx = this.walletTransactionRepository.create({
        id: txId,
        walletId: wallet.id,
        customerId: paymentDto.customerId,
        type: 'PAYMENT',
        amount: remainingAmount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        refType: 'ORDER',
        refId: orderId,
      });
      await this.walletTransactionRepository.save(walletTx);
    }

    const payment = this.paymentRepository.create({
      ...paymentDto,
      orderId: orderId,
      status: 'SUCCESS',
    });

    await this.paymentRepository.save(payment);

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
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestException('Order must be fully paid before completion');
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

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    const customer = await this.customerRepository.findOne({
      where: { userId },
    });
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

  async findPendingCashOrders(branchId?: string) {
    return this.findAll(branchId, 'PENDING_PAYMENT');
  }

  async findPreparingOrders(branchId?: string) {
    return this.findAll(branchId, 'PREPARING');
  }

  async findReadyToPickupOrders(branchId?: string) {
    return this.findAll(branchId, 'READY_TO_PICKUP');
  }

  async receiveCashPayment(orderId: string, paymentDto: { amount: number; createdBy?: string }) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    if (order.paymentStatus !== 'UNPAID') {
      throw new BadRequestException('Order payment must be in UNPAID status');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Order status must be PENDING_PAYMENT');
    }

    // Create payment record
    const payment = this.paymentRepository.create({
      orderId: orderId,
      method: 'CASH',
      amount: Number(paymentDto.amount),
      status: 'SUCCESS',
    });
    await this.paymentRepository.save(payment);

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
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    await this.orderRepository.update(orderId, {
      status,
      updatedAt: new Date(),
    });

    return this.getOrderWithItems(orderId);
  }

  async cancelOrder(orderId: string, dto?: { reason?: string; isRefunded?: boolean }) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

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
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', orderId),
      );
    }

    // Delete order items first (if cascade not set)
    await this.orderItemRepository.delete({ orderId });

    // Delete order
    await this.orderRepository.delete(orderId);

    return { message: 'Order deleted successfully' };
  }
}
