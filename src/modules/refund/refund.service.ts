import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Refund } from '../../entities/refund.entity';
import { RefundItem } from '../../entities/refund-item.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Payment } from '../../entities/payment.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RefundService extends BaseService<Refund> {
  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(RefundItem)
    private refundItemRepository: Repository<RefundItem>,
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
  ) {
    super(refundRepository);
  }

  protected getEntityName(): string {
    return 'Refund';
  }

  /**
   * Tạo refund cho một order. Refund ở trạng thái PENDING, chờ duyệt.
   */
  async createRefund(dto: CreateRefundDto, userId: string): Promise<Refund> {
    return this.runInTransaction(async () => {
      const order = await this.orderRepository.findOne({
        where: { id: dto.orderId },
      });
      if (!order) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', dto.orderId),
        );
      }

      if (!['PAID', 'COMPLETED'].includes(order.status)) {
        throw new BadRequestException(
          `Chỉ có thể hoàn tiền cho đơn đã PAID/COMPLETED (hiện tại: ${order.status})`,
        );
      }

      if (order.paymentStatus === 'REFUNDED') {
        throw new BadRequestException('Đơn hàng này đã được hoàn tiền');
      }

      // Validate items
      const orderItemIds = dto.items.map((i) => i.orderItemId);
      const orderItems = await this.orderItemRepository.find({
        where: { id: In(orderItemIds), orderId: dto.orderId },
      });

      if (orderItems.length !== orderItemIds.length) {
        throw new BadRequestException(
          'Có order_item không thuộc đơn này hoặc không tồn tại',
        );
      }

      // Check item-level capacity
      const orderItemMap = new Map(orderItems.map((oi) => [oi.id, oi]));
      for (const i of dto.items) {
        const oi = orderItemMap.get(i.orderItemId);
        if (!oi) continue;
        if (oi.status === 'REFUNDED') {
          throw new BadRequestException(
            `Item ${oi.productName} đã được hoàn trước đó`,
          );
        }
        if (i.quantity > oi.quantity) {
          throw new BadRequestException(
            `Số lượng hoàn (${i.quantity}) vượt quá số lượng đã bán (${oi.quantity}) của ${oi.productName}`,
          );
        }
      }

      const refundAmount = dto.items.reduce(
        (sum, i) => sum + Number(i.amount),
        0,
      );

      if (refundAmount > Number(order.totalAmount)) {
        throw new BadRequestException(
          `Tổng tiền hoàn (${refundAmount}) không được vượt quá tổng đơn (${order.totalAmount})`,
        );
      }

      const refundCode = `RF${Date.now()}${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const refund = this.refundRepository.create({
        orderId: dto.orderId,
        refundCode,
        refundAmount,
        reason: dto.reason,
        status: 'PENDING',
        createdBy: userId,
      });
      const savedRefund = await this.refundRepository.save(refund);

      // Create refund_items
      const refundItems = dto.items.map((i) =>
        this.refundItemRepository.create({
          refundId: savedRefund.id,
          orderItemId: i.orderItemId,
          quantity: i.quantity,
          amount: i.amount,
          createdBy: userId,
        }),
      );
      await this.refundItemRepository.save(refundItems);

      return savedRefund;
    });
  }

  /**
   * Duyệt refund. Logic:
   * - Cập nhật refund.status = APPROVED → COMPLETED
   * - Đánh dấu order_items.status = REFUNDED
   * - Nếu order paid bằng WALLET → cộng tiền lại vào ví, ghi wallet_transactions type=REFUND
   * - Đánh dấu order.paymentStatus = REFUNDED, order.status = REFUNDED (nếu hoàn toàn bộ)
   */
  async approveRefund(refundId: string, userId: string): Promise<Refund> {
    return this.runInTransaction(async () => {
      const refund = await this.refundRepository.findOne({
        where: { id: refundId },
      });
      if (!refund) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Refund', refundId),
        );
      }
      if (refund.status !== 'PENDING') {
        throw new BadRequestException(
          `Refund đang ở trạng thái ${refund.status}, không thể duyệt`,
        );
      }

      const refundItems = await this.refundItemRepository.find({
        where: { refundId: refund.id },
      });

      const order = await this.orderRepository.findOne({
        where: { id: refund.orderId },
      });
      if (!order) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Order', refund.orderId),
        );
      }

      // Mark order items as REFUNDED
      const orderItemIds = refundItems.map((ri) => ri.orderItemId);
      if (orderItemIds.length > 0) {
        await this.orderItemRepository.update(
          { id: In(orderItemIds) },
          { status: 'REFUNDED', updatedBy: userId },
        );
      }

      // If paid via WALLET → refund to wallet
      const walletPayments = await this.paymentRepository.find({
        where: {
          orderId: order.id,
          method: 'WALLET',
          status: 'SUCCESS',
        },
      });

      const refundAmountNum = Number(refund.refundAmount);
      let totalWalletPaid = walletPayments.reduce(
        (s, p) => s + Number(p.amount),
        0,
      );
      let amountToRefundWallet = Math.min(refundAmountNum, totalWalletPaid);

      if (amountToRefundWallet > 0 && order.customerId) {
        const wallet = await this.walletRepository.findOne({
          where: { customerId: order.customerId },
        });
        if (wallet) {
          const balanceBefore = Number(wallet.balance);
          const balanceAfter = balanceBefore + amountToRefundWallet;
          wallet.balance = balanceAfter;
          wallet.updatedBy = userId;
          await this.walletRepository.save(wallet);

          const walletTx = this.walletTransactionRepository.create({
            walletId: wallet.id,
            customerId: order.customerId,
            type: 'REFUND',
            amount: amountToRefundWallet,
            balanceBefore,
            balanceAfter,
            refType: 'REFUND',
            refId: refund.id,
            note: `Hoàn tiền cho đơn ${order.orderCode}`,
            createdBy: userId,
          });
          await this.walletTransactionRepository.save(walletTx);
        }
      }

      // Mark wallet payments as REFUNDED
      if (walletPayments.length > 0) {
        await this.paymentRepository.update(
          { id: In(walletPayments.map((p) => p.id)) },
          { status: 'REFUNDED', updatedBy: userId },
        );
      }

      // Update order
      const isFullRefund = refundAmountNum >= Number(order.totalAmount);
      const now = new Date();
      await this.orderRepository.update(order.id, {
        paymentStatus: 'REFUNDED',
        status: isFullRefund ? 'REFUNDED' : order.status,
        updatedBy: userId,
      });

      // Update refund
      refund.status = 'COMPLETED';
      refund.approvedBy = userId;
      refund.approvedAt = now;
      refund.completedAt = now;
      refund.updatedBy = userId;
      return this.refundRepository.save(refund);
    });
  }

  /**
   * Từ chối refund. Refund chuyển sang REJECTED, kèm lý do.
   */
  async rejectRefund(
    refundId: string,
    userId: string,
    reason: string,
  ): Promise<Refund> {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId },
    });
    if (!refund) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Refund', refundId),
      );
    }
    if (refund.status !== 'PENDING') {
      throw new BadRequestException(
        `Refund đang ở trạng thái ${refund.status}, không thể từ chối`,
      );
    }
    refund.status = 'REJECTED';
    refund.approvedBy = userId;
    refund.approvedAt = new Date();
    refund.reason = `${refund.reason} | REJECTED: ${reason}`;
    refund.updatedBy = userId;
    return this.refundRepository.save(refund);
  }

  /**
   * Lấy refund kèm danh sách items.
   */
  async findOneWithItems(id: string) {
    const refund = await this.refundRepository.findOne({ where: { id } });
    if (!refund) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Refund', id),
      );
    }
    const items = await this.refundItemRepository.find({
      where: { refundId: id },
    });
    return { ...refund, items };
  }

  async findByOrder(orderId: string) {
    return this.refundRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
