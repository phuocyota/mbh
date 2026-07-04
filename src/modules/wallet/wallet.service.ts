import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Customer } from '../../entities/customer.entity';
import { StockFundReceiptReason } from '../../entities/stock-fund-receipt-reason.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { CustomerService } from '../customer/customer.service';
import {
  COMMON_STATUS,
  WALLET_TRANSACTION_REF_TYPE,
  WALLET_TRANSACTION_TYPE,
} from '../../common/constant/constant';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

const DEFERRED_PAYMENT_REASON_CODE = 'TT_TRA_CHAM';

export interface TopupResult {
  walletId: string;
  customerId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
}

@Injectable()
export class WalletService extends BaseService<Wallet> {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
    private customerService: CustomerService,
  ) {
    super(walletRepository);
  }

  protected getEntityName(): string {
    return 'Wallet';
  }

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const query = this.walletRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.customer', 'customer')
      .leftJoin('users', 'customerUser', 'customerUser.id = customer.user_id')
      .orderBy('wallet.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    if (branchId) {
      query.andWhere('customerUser.branch_id = :branchId', { branchId });
    }

    const [data, total] = await query.getManyAndCount();
    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  /**
   * Lấy số dư ví theo customerId. Nếu chưa có ví thì tạo mới với balance=0.
   */
  async getBalanceByCustomer(customerId: string) {
    const customer = await this.customerService.findById(customerId);
    if (!customer) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Customer', customerId),
      );
    }

    let wallet = await this.walletRepository.findOne({
      where: { customerId },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        customerId,
        balance: 0,
        status: COMMON_STATUS.ACTIVE,
      });
      wallet = await this.walletRepository.save(wallet);
    }

    return {
      walletId: wallet.id,
      customerId: wallet.customerId,
      balance: Number(wallet.balance),
      status: wallet.status,
    };
  }

  /**
   * Nạp tiền vào ví của customer. Tự động tạo ví nếu chưa có.
   * Ghi nhận giao dịch type=TOPUP trong wallet_transactions.
   */
  async topup(
    customerId: string,
    amount: number,
    createdBy: string,
    note?: string,
  ): Promise<TopupResult> {
    if (amount <= 0) {
      throw new BadRequestException('Số tiền nạp phải lớn hơn 0');
    }

    return this.walletRepository.manager.transaction(async (manager) => {
      const customerRepository = manager.getRepository(Customer);
      const walletRepository = manager.getRepository(Wallet);
      const walletTransactionRepository =
        manager.getRepository(WalletTransaction);
      const reasonRepository = manager.getRepository(StockFundReceiptReason);

      const customer = await customerRepository.findOne({
        where: { id: customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!customer) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Customer', customerId),
        );
      }

      let wallet = await walletRepository.findOne({
        where: { customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        wallet = walletRepository.create({
          customerId,
          balance: 0,
          status: COMMON_STATUS.ACTIVE,
          createdBy,
        });
        wallet = await walletRepository.save(wallet);
      }

      if (wallet.status !== COMMON_STATUS.ACTIVE) {
        throw new BadRequestException('Ví không ở trạng thái ACTIVE');
      }

      const balanceBefore = Number(wallet.balance);
      const topupAmount = Number(amount);
      const outstandingAdvance = Math.max(0, -balanceBefore);
      if (outstandingAdvance <= 0) {
        throw new BadRequestException(
          'Customer has no advance amount to repay',
        );
      }
      if (topupAmount > outstandingAdvance) {
        throw new BadRequestException(
          'Topup amount cannot exceed the outstanding advance amount',
        );
      }

      const balanceAfter = balanceBefore + topupAmount;

      wallet.balance = balanceAfter;
      wallet.updatedBy = createdBy;
      await walletRepository.save(wallet);
      await this.restoreDebtLimitForRecoveredDebt(
        manager,
        customerId,
        balanceBefore,
        balanceAfter,
      );

      const deferredReason = await reasonRepository.findOne({
        where: { code: DEFERRED_PAYMENT_REASON_CODE },
      });
      if (!deferredReason?.accountingFormula) {
        throw new BadRequestException(
          'Deferred payment accounting reason is not configured',
        );
      }

      const tx = walletTransactionRepository.create({
        walletId: wallet.id,
        customerId,
        type: WALLET_TRANSACTION_TYPE.TOPUP,
        amount: topupAmount,
        balanceBefore,
        balanceAfter,
        refType: WALLET_TRANSACTION_REF_TYPE.MANUAL,
        reasonCode: DEFERRED_PAYMENT_REASON_CODE,
        note,
        createdBy,
      });
      const savedTx = await walletTransactionRepository.save(tx);

      return {
        walletId: wallet.id,
        customerId,
        amount,
        balanceBefore,
        balanceAfter,
        transactionId: savedTx.id,
      };
    });
  }

  async chargeForOrder(customerId: string, amount: number, orderId: string) {
    if (amount <= 0) {
      return null;
    }

    // Debt is represented by a negative wallet balance. debtLimit is the customer's
    // remaining allowance and is reduced only by newly created debt.
    return this.walletRepository.manager.transaction(async (manager) => {
      const customerRepository = manager.getRepository(Customer);
      const walletRepository = manager.getRepository(Wallet);
      const walletTransactionRepository =
        manager.getRepository(WalletTransaction);

      const customer = await customerRepository.findOne({
        where: { id: customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!customer) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Customer', customerId),
        );
      }

      let wallet = await walletRepository.findOne({
        where: { customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        wallet = walletRepository.create({
          customerId,
          balance: 0,
          status: COMMON_STATUS.ACTIVE,
        });
        wallet = await walletRepository.save(wallet);
      }
      if (wallet.status !== COMMON_STATUS.ACTIVE) {
        throw new BadRequestException('Wallet is not active');
      }

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore - amount;
      const debtBefore = Math.max(0, -balanceBefore);
      const debtAfter = Math.max(0, -balanceAfter);
      const debtIncrease = debtAfter - debtBefore;

      if (debtIncrease > 0) {
        const debtLimit = Number(customer.debtLimit || 0);

        if (debtIncrease > debtLimit) {
          throw new BadRequestException('Vượt quá số nợ cho phép');
        }

        customer.debtLimit = debtLimit - debtIncrease;
        await customerRepository.save(customer);
      }

      wallet.balance = balanceAfter;
      await walletRepository.save(wallet);

      const tx = walletTransactionRepository.create({
        walletId: wallet.id,
        customerId,
        type: WALLET_TRANSACTION_TYPE.PAYMENT,
        amount,
        balanceBefore,
        balanceAfter,
        refType: WALLET_TRANSACTION_REF_TYPE.ORDER,
        refId: orderId,
      });

      return walletTransactionRepository.save(tx);
    });
  }

  async refundToWallet(
    customerId: string,
    amount: number,
    refundId: string,
    orderCode: string,
    updatedBy: string,
  ) {
    if (amount <= 0) {
      return null;
    }

    const wallet = await this.walletRepository.findOne({
      where: { customerId },
    });

    if (!wallet) {
      return null;
    }

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + amount;
    wallet.balance = balanceAfter;
    wallet.updatedBy = updatedBy;
    await this.walletRepository.save(wallet);
    await this.restoreDebtLimitForRecoveredDebt(
      this.walletRepository.manager,
      customerId,
      balanceBefore,
      balanceAfter,
    );

    const walletTx = this.walletTransactionRepository.create({
      walletId: wallet.id,
      customerId,
      type: WALLET_TRANSACTION_TYPE.REFUND,
      amount,
      balanceBefore,
      balanceAfter,
      refType: WALLET_TRANSACTION_REF_TYPE.REFUND,
      refId: refundId,
      note: `Hoàn tiền cho đơn ${orderCode}`,
      createdBy: updatedBy,
    });

    return this.walletTransactionRepository.save(walletTx);
  }

  private async restoreDebtLimitForRecoveredDebt(
    manager: EntityManager,
    customerId: string,
    balanceBefore: number,
    balanceAfter: number,
  ): Promise<void> {
    // When topup/refund reduces a negative wallet balance, restore that amount
    // back to the customer's remaining debt allowance.
    const debtBefore = Math.max(0, -balanceBefore);
    const debtAfter = Math.max(0, -balanceAfter);
    const debtDecrease = debtBefore - debtAfter;

    if (debtDecrease <= 0) {
      return;
    }

    await manager
      .getRepository(Customer)
      .increment({ id: customerId }, 'debtLimit', debtDecrease);
  }

  /**
   * Lịch sử giao dịch ví của 1 customer (mới nhất trước).
   */
  async getTransactionsByCustomer(customerId: string, page = 1, size = 20) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeSize = Math.min(Math.max(Number(size) || 20, 1), 100);

    const [data, total] = await this.walletTransactionRepository.findAndCount({
      where: { customerId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    });

    return {
      data,
      page: safePage,
      size: safeSize,
      total,
    };
  }

  async findMomoTopupByTransId(transId: string) {
    return this.walletTransactionRepository.findOne({
      where: {
        type: WALLET_TRANSACTION_TYPE.TOPUP,
        note: `Nap tien qua MoMo (GD: ${transId})`,
      },
    });
  }
}
