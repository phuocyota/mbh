import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Customer } from '../../entities/customer.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';

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
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {
    super(walletRepository);
  }

  protected getEntityName(): string {
    return 'Wallet';
  }

  /**
   * Lấy số dư ví theo customerId. Nếu chưa có ví thì tạo mới với balance=0.
   */
  async getBalanceByCustomer(customerId: string) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
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
        status: 'ACTIVE',
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

    return this.runInTransaction(async () => {
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
      });
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
          status: 'ACTIVE',
          createdBy,
        });
        wallet = await this.walletRepository.save(wallet);
      }

      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Ví không ở trạng thái ACTIVE');
      }

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + Number(amount);

      wallet.balance = balanceAfter;
      wallet.updatedBy = createdBy;
      await this.walletRepository.save(wallet);

      const tx = this.walletTransactionRepository.create({
        walletId: wallet.id,
        customerId,
        type: 'TOPUP',
        amount,
        balanceBefore,
        balanceAfter,
        refType: 'MANUAL',
        note,
        createdBy,
      });
      const savedTx = await this.walletTransactionRepository.save(tx);

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

  /**
   * Lịch sử giao dịch ví của 1 customer (mới nhất trước).
   */
  async getTransactionsByCustomer(
    customerId: string,
    page = 1,
    size = 20,
  ) {
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
}
