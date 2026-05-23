import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund } from '../../entities/refund.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundItemService } from '../refund-item/refund-item.service';
import { OrderService } from '../orders/order.service';
import { OrderItemService } from '../order-item/order-item.service';
import { PaymentService } from '../payment/payment.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class RefundService extends BaseService<Refund> {
  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    private refundItemService: RefundItemService,
    private orderService: OrderService,
    private orderItemService: OrderItemService,
    private paymentService: PaymentService,
    private walletService: WalletService,
  ) {
    super(refundRepository);
  }

  protected getEntityName(): string {
    return 'Refund';
  }

  async createRefund(dto: CreateRefundDto, userId: string): Promise<Refund> {
    return this.runInTransaction(async () => {
      const order = await this.orderService.findOrderByIdOrThrow(dto.orderId);

      if (!['PAID', 'COMPLETED'].includes(order.status)) {
        throw new BadRequestException(
          `Chi co the hoan tien cho don da PAID/COMPLETED (hien tai: ${order.status})`,
        );
      }

      if (order.paymentStatus === 'REFUNDED') {
        throw new BadRequestException('Don hang nay da duoc hoan tien');
      }

      const orderItemIds = dto.items.map((item) => item.orderItemId);
      const orderItems = await this.orderItemService.findByIdsForOrder(
        dto.orderId,
        orderItemIds,
      );

      if (orderItems.length !== orderItemIds.length) {
        throw new BadRequestException(
          'Co order_item khong thuoc don nay hoac khong ton tai',
        );
      }

      const orderItemMap = new Map(orderItems.map((item) => [item.id, item]));
      for (const item of dto.items) {
        const orderItem = orderItemMap.get(item.orderItemId);
        if (!orderItem) {
          continue;
        }

        if (orderItem.status === 'REFUNDED') {
          throw new BadRequestException(
            `Item ${orderItem.productName} da duoc hoan truoc do`,
          );
        }

        if (item.quantity > orderItem.quantity) {
          throw new BadRequestException(
            `So luong hoan (${item.quantity}) vuot qua so luong da ban (${orderItem.quantity}) cua ${orderItem.productName}`,
          );
        }
      }

      const refundAmount = dto.items.reduce(
        (sum, item) => sum + Number(item.amount),
        0,
      );

      if (refundAmount > Number(order.totalAmount)) {
        throw new BadRequestException(
          `Tong tien hoan (${refundAmount}) khong duoc vuot qua tong don (${order.totalAmount})`,
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

      await this.refundItemService.createManyForRefund(
        savedRefund.id,
        dto.items,
        userId,
      );

      return savedRefund;
    });
  }

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
          `Refund dang o trang thai ${refund.status}, khong the duyet`,
        );
      }

      const refundItems = await this.refundItemService.findByRefund(refund.id);
      const order = await this.orderService.findOrderByIdOrThrow(
        refund.orderId,
      );

      const orderItemIds = refundItems.map((item) => item.orderItemId);
      await this.orderItemService.markRefunded(orderItemIds, userId);

      const walletPayments =
        await this.paymentService.findSuccessfulWalletByOrder(order.id);
      const refundAmount = Number(refund.refundAmount);
      const totalWalletPaid = walletPayments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const amountToRefundWallet = Math.min(refundAmount, totalWalletPaid);

      if (amountToRefundWallet > 0 && order.customerId) {
        await this.walletService.refundToWallet(
          order.customerId,
          amountToRefundWallet,
          refund.id,
          order.orderCode,
          userId,
        );
      }

      await this.paymentService.markRefunded(
        walletPayments.map((payment) => payment.id),
        userId,
      );

      const isFullRefund = refundAmount >= Number(order.totalAmount);
      const now = new Date();
      await this.orderService.markRefunded(order.id, isFullRefund, userId);

      refund.status = 'COMPLETED';
      refund.approvedBy = userId;
      refund.approvedAt = now;
      refund.completedAt = now;
      refund.updatedBy = userId;
      return this.refundRepository.save(refund);
    });
  }

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
        `Refund dang o trang thai ${refund.status}, khong the tu choi`,
      );
    }
    refund.status = 'REJECTED';
    refund.approvedBy = userId;
    refund.approvedAt = new Date();
    refund.reason = `${refund.reason} | REJECTED: ${reason}`;
    refund.updatedBy = userId;
    return this.refundRepository.save(refund);
  }

  async findOneWithItems(id: string) {
    const refund = await this.refundRepository.findOne({ where: { id } });
    if (!refund) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Refund', id),
      );
    }
    const items = await this.refundItemService.findByRefund(id);
    return { ...refund, items };
  }

  async findByOrder(orderId: string) {
    return this.refundRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
