import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  Order,
  OrderItem,
  Payment,
  Wallet,
  WalletTransaction,
  StudentCard,
  Customer,
  Product,
  KitchenTicket,
  KitchenTicketItem,
} from 'src/entities';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { KioskCheckoutDto } from './dto/kiosk-checkout.dto';

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
    @InjectRepository(StudentCard)
    private studentCardRepository: Repository<StudentCard>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(KitchenTicket)
    private kitchenTicketRepository: Repository<KitchenTicket>,
    @InjectRepository(KitchenTicketItem)
    private kitchenTicketItemRepository: Repository<KitchenTicketItem>,
  ) {}

  /**
   * Self-service checkout từ kiosk:
   * - Auth bằng cardUid → tìm customer + ví
   * - Tạo order + order_items
   * - Trừ ví (yêu cầu đủ số dư)
   * - Tạo payment WALLET, wallet_transaction
   * - Tạo kitchen_ticket + items (gửi bếp)
   * - Order status = PREPARING
   * Tất cả trong 1 transaction.
   */
  async kioskCheckout(dto: KioskCheckoutDto) {
    const queryRunner = this.orderRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Student card -> customer
      const studentCard = await queryRunner.manager
        .createQueryBuilder(StudentCard, 'studentCard')
        .innerJoinAndSelect('studentCard.studentProfile', 'studentProfile')
        .innerJoinAndSelect('studentProfile.customer', 'customer')
        .where(
          '(studentCard.cardUid = :cardUid OR studentCard.cardNumber = :cardUid)',
          { cardUid: dto.cardUid },
        )
        .getOne();
      if (!studentCard) {
        throw new NotFoundException(`Thẻ ${dto.cardUid} không tồn tại`);
      }
      if (studentCard.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Thẻ đang ở trạng thái ${studentCard.status}`,
        );
      }
      const customer = studentCard.studentProfile.customer;
      if (!customer || customer.status !== 'ACTIVE') {
        throw new BadRequestException('Khách hàng không hợp lệ');
      }

      // 2. Wallet
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { customerId: customer.id },
      });
      if (!wallet) {
        throw new BadRequestException('Khách hàng chưa có ví');
      }
      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Ví không ở trạng thái ACTIVE');
      }

      // 3. Resolve products (lấy giá hiện tại từ DB, không tin client)
      const productIds = dto.items.map((i) => i.productId);
      const products = await queryRunner.manager.findBy(Product, {
        id: In(productIds),
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException('Có sản phẩm không tồn tại');
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 4. Build order_items + tổng
      let subtotal = 0;
      const orderItemsData = dto.items.map((line) => {
        const p = productMap.get(line.productId)!;
        if (!p.isActive) {
          throw new BadRequestException(
            `Sản phẩm ${p.name} đang ngừng bán`,
          );
        }
        const lineTotal = Number(p.price) * line.quantity;
        subtotal += lineTotal;
        return {
          productId: p.id,
          productName: p.name,
          unitPrice: Number(p.price),
          quantity: line.quantity,
          subtotal: lineTotal,
          discountAmount: 0,
          totalAmount: lineTotal,
          status: 'NORMAL',
        };
      });

      const totalAmount = subtotal;

      // 5. Check wallet balance
      const balanceBefore = Number(wallet.balance);
      if (balanceBefore < totalAmount) {
        throw new BadRequestException(
          `Số dư ví không đủ. Còn ${balanceBefore.toLocaleString('vi-VN')} đ, cần ${totalAmount.toLocaleString('vi-VN')} đ`,
        );
      }

      // 6. Create order
      const orderCode = `ORD${Date.now()}${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;
      const order = queryRunner.manager.create(Order, {
        orderCode,
        branchId: dto.branchId,
        posDeviceId: dto.posDeviceId,
        customerId: customer.id,
        cashierId: customer.id, // kiosk: customer tự thao tác, dùng customer.id làm placeholder
        orderType: 'TAKEAWAY',
        status: 'PAID',
        subtotal,
        discountAmount: 0,
        totalAmount,
        paidAmount: totalAmount,
        changeAmount: 0,
        paymentStatus: 'PAID',
        note: dto.note,
        paidAt: new Date(),
      });
      const savedOrder = await queryRunner.manager.save(order);

      // 7. Create order_items
      const orderItems = orderItemsData.map((d) =>
        queryRunner.manager.create(OrderItem, {
          ...d,
          orderId: savedOrder.id,
        }),
      );
      const savedItems = await queryRunner.manager.save(orderItems);

      // 8. Trừ ví + ghi wallet_transaction
      const balanceAfter = balanceBefore - totalAmount;
      wallet.balance = balanceAfter;
      await queryRunner.manager.save(wallet);

      const walletTx = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        customerId: customer.id,
        type: 'PAYMENT',
        amount: totalAmount,
        balanceBefore,
        balanceAfter,
        refType: 'ORDER',
        refId: savedOrder.id,
        note: `Thanh toán đơn ${orderCode} (kiosk)`,
      });
      await queryRunner.manager.save(walletTx);

      // 9. Create payment
      const payment = queryRunner.manager.create(Payment, {
        orderId: savedOrder.id,
        method: 'WALLET',
        amount: totalAmount,
        status: 'SUCCESS',
        paidByCustomerId: customer.id,
      });
      await queryRunner.manager.save(payment);

      // 10. Create kitchen_ticket + items
      const ticket = queryRunner.manager.create(KitchenTicket, {
        orderId: savedOrder.id,
        branchId: dto.branchId,
        status: 'WAITING',
      });
      const savedTicket = await queryRunner.manager.save(ticket);

      const ticketItems = savedItems.map((oi) =>
        queryRunner.manager.create(KitchenTicketItem, {
          kitchenTicketId: savedTicket.id,
          orderItemId: oi.id,
          productName: oi.productName,
          quantity: oi.quantity,
          status: 'WAITING',
        }),
      );
      await queryRunner.manager.save(ticketItems);

      // 11. Update order → PREPARING
      savedOrder.status = 'PREPARING';
      await queryRunner.manager.save(savedOrder);

      await queryRunner.commitTransaction();

      return {
        order: {
          id: savedOrder.id,
          orderCode: savedOrder.orderCode,
          status: 'PREPARING',
          totalAmount,
          paidAt: savedOrder.paidAt,
        },
        kitchenTicket: {
          id: savedTicket.id,
          status: 'WAITING',
        },
        wallet: {
          balanceBefore,
          balanceAfter,
        },
        customer: {
          id: customer.id,
          fullName: customer.fullName,
          customerCode: customer.customerCode,
        },
        items: orderItemsData,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createOrder(createOrderDto: any) {
    const orderCode = `ORD${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Calculate totals from items if provided
    let subtotal = 0;
    let totalAmount = 0;
    const items = createOrderDto.items || [];

    if (items.length > 0) {
      subtotal = items.reduce((sum: number, item: any) => {
        const itemSubtotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
        return sum + itemSubtotal;
      }, 0);
      const discount = items.reduce((sum: number, item: any) => sum + Number(item.discountAmount || 0), 0);
      totalAmount = subtotal - discount;
    }

    const order = this.orderRepository.create({
      ...createOrderDto,
      orderCode: orderCode,
      status: 'Pending',
      paymentStatus: 'UNPAID',
      subtotal: subtotal > 0 ? subtotal : null,
      totalAmount: totalAmount > 0 ? totalAmount : null,
    });

    const savedResult = await this.orderRepository.save(order);
    const savedOrder = Array.isArray(savedResult) ? savedResult[0] : savedResult;

    // Create order items if provided
    if (items.length > 0) {
      for (const itemDto of items) {
        const itemSubtotal = Number(itemDto.unitPrice || 0) * Number(itemDto.quantity || 0);
        const orderItem = this.orderItemRepository.create({
          ...itemDto,
          orderId: savedOrder.id,
          subtotal: itemSubtotal,
          totalAmount: itemSubtotal - Number(itemDto.discountAmount || 0),
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

    // Handle wallet payment
    if (paymentDto.method === 'WALLET') {
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
      if (Number(wallet.balance) < Number(paymentDto.amount)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newBalance = Number(wallet.balance) - Number(paymentDto.amount);
      await this.walletRepository.update(wallet.id, { balance: newBalance });

      // Log transaction
      const txId = uuid();
      const walletTx = this.walletTransactionRepository.create({
        id: txId,
        walletId: wallet.id,
        customerId: paymentDto.customerId,
        type: 'PAYMENT',
        amount: paymentDto.amount,
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

    // Update order status
    const paidAmount = (order.paidAmount || 0) + paymentDto.amount;
    const isPaid = paidAmount >= order.totalAmount;

    await this.orderRepository.update(orderId, {
      paidAmount: paidAmount,
      changeAmount: paidAmount - order.totalAmount,
      paymentStatus: isPaid ? 'PAID' : 'PARTIAL',
      status: isPaid ? 'PENDING_PAYMENT' : 'DRAFT',
      paidAt: isPaid ? new Date() : undefined,
    });

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
