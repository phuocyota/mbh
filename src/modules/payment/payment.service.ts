import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class PaymentService extends BaseService<Payment> {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {
    super(paymentRepository);
  }

  protected getEntityName(): string {
    return 'Payment';
  }

  async createSuccessPayment(paymentDto: any): Promise<Payment> {
    const payment = this.paymentRepository.create({
      ...paymentDto,
      status: 'SUCCESS',
    } as Partial<Payment>);

    return this.paymentRepository.save(payment);
  }

  async findSuccessfulByOrder(orderId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { orderId, status: 'SUCCESS' },
    });
  }

  async findSuccessfulWalletByOrder(orderId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        orderId,
        method: 'WALLET',
        status: 'SUCCESS',
      },
    });
  }

  async markRefunded(ids: string[], updatedBy: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.paymentRepository.update(
      { id: In(ids) },
      { status: 'REFUNDED', updatedBy },
    );
  }

  async getPaymentBreakdown(query: {
    from: Date;
    to: Date;
    branchId?: string;
  }) {
    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('orders', 'o', 'o.id = p.order_id')
      .where('p.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere("p.status = 'SUCCESS'");
    if (query.branchId) {
      qb.andWhere('o.branch_id = :branchId', {
        branchId: query.branchId,
      });
    }

    return qb
      .select('p.method', 'method')
      .addSelect('COUNT(p.id)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .groupBy('p.method')
      .getRawMany<{ method: string; count: string; amount: string }>();
  }

  async getShiftCashAggregate(query: {
    cashierId: string;
    branchId: string;
    from: Date;
    to: Date;
  }) {
    return this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('orders', 'o', 'o.id = p.order_id')
      .select(
        "COALESCE(SUM(CASE WHEN p.method = 'CASH' THEN p.amount ELSE 0 END), 0)",
        'cashRevenue',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.method = 'WALLET' THEN p.amount ELSE 0 END), 0)",
        'walletRevenue',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.method NOT IN ('CASH','WALLET') THEN p.amount ELSE 0 END), 0)",
        'otherRevenue',
      )
      .where('o.cashier_id = :cashierId', { cashierId: query.cashierId })
      .andWhere('o.branch_id = :branchId', { branchId: query.branchId })
      .andWhere('p.created_at BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .andWhere("p.status = 'SUCCESS'")
      .getRawOne<{
        cashRevenue: string;
        walletRevenue: string;
        otherRevenue: string;
      }>();
  }
}
