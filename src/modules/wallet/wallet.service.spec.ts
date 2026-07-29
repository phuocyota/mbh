import { BadRequestException } from '@nestjs/common';
import { Customer } from '../../entities/customer.entity';
import { Fund } from '../../entities/fund.entity';
import { StockFundReceiptReason } from '../../entities/stock-fund-receipt-reason.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { WalletService } from './wallet.service';

describe('WalletService credit flows', () => {
  const customerId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const fundId = '33333333-3333-4333-8333-333333333333';
  const branchId = '66666666-6666-4666-8666-666666666666';

  const createContext = ({
    balance = -30000,
    fundAccountCode = '1111',
  }: {
    balance?: number;
    fundAccountCode?: string;
  } = {}) => {
    const customer = {
      id: customerId,
      customerCode: 'KH001',
      fullName: 'Khách hàng test',
    };
    const wallet = {
      id: '44444444-4444-4444-8444-444444444444',
      customerId,
      balance,
      status: 'ACTIVE',
    };
    const fund = {
      id: fundId,
      branchId,
      accountCode: fundAccountCode,
      status: 'active',
    };
    const savedTransaction = {
      id: '55555555-5555-4555-8555-555555555555',
    };

    const customerRepository = {
      findOne: jest.fn().mockResolvedValue(customer),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    const walletRepository = {
      findOne: jest.fn().mockResolvedValue(wallet),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const walletTransactionRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(savedTransaction),
    };
    const fundQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(fund),
    };
    const fundRepository = {
      findOne: jest.fn().mockResolvedValue(fund),
      createQueryBuilder: jest.fn().mockReturnValue(fundQueryBuilder),
    };
    const reasonRepository = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.code === 'TNBHTS_BANK') {
          return Promise.resolve({
            code: 'TNBHTS_BANK',
            status: 'active',
            accountingFormula: '{112:-,131:+}',
          });
        }

        if (where.code === 'TNBHTS') {
          return Promise.resolve({
            code: 'TNBHTS',
            status: 'active',
            accountingFormula: '{111:-,131:+}',
          });
        }

        return Promise.resolve({
          code: where.code,
          status: 'active',
          accountingFormula: '{112:-,131:-}',
        });
      }),
    };

    const manager = {
      query: jest.fn().mockResolvedValue([{ branch_id: branchId }]),
      getRepository: jest.fn((entity) => {
        if (entity === Customer) return customerRepository;
        if (entity === Wallet) return walletRepository;
        if (entity === WalletTransaction) return walletTransactionRepository;
        if (entity === Fund) return fundRepository;
        if (entity === StockFundReceiptReason) return reasonRepository;
        throw new Error(`Unexpected repository: ${entity?.name}`);
      }),
    };
    const rootWalletRepository = {
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
    };
    const financeService = {
      createMoneyVoucher: jest.fn().mockResolvedValue({ id: 'voucher-id' }),
    };

    const service = new WalletService(
      rootWalletRepository as any,
      walletTransactionRepository as any,
      {} as any,
      financeService as any,
    );

    return {
      service,
      manager,
      customerRepository,
      walletRepository,
      walletTransactionRepository,
      fundRepository,
      fundQueryBuilder,
      financeService,
      wallet,
    };
  };

  it('clears cash debt and creates the receipt in the same transaction', async () => {
    const context = createContext();
    const cashRepaymentSpy = jest.spyOn(context.service, 'repayDebtByCash');

    const result = await context.service.clearCustomerDebt(
      customerId,
      30000,
      userId,
      'Thu hồi công nợ',
      fundId,
      'CASH',
    );

    expect(result.balanceBefore).toBe(-30000);
    expect(result.balanceAfter).toBe(0);
    expect(context.wallet.balance).toBe(0);
    expect(cashRepaymentSpy).toHaveBeenCalledWith(
      customerId,
      30000,
      userId,
      'Thu hồi công nợ',
      fundId,
    );
    expect(context.customerRepository.increment).toHaveBeenCalledWith(
      { id: customerId },
      'debtLimit',
      30000,
    );
    expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
      expect.objectContaining({
        fundId,
        amount: 30000,
        customerId,
        reasonCode: 'TNBHTS',
      }),
      context.manager,
    );
  });

  it('uses a bank fund when the receipt payment method is BANK', async () => {
    const context = createContext({ fundAccountCode: '1121' });

    await context.service.clearCustomerDebt(
      customerId,
      10000,
      userId,
      undefined,
      undefined,
      'BANK',
    );

    expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId,
        fundId: undefined,
        amount: 10000,
        reasonCode: 'TNBHTS_BANK',
      }),
      context.manager,
    );
  });

  it('delegates a legacy fund hint to FinanceService for formula validation', async () => {
    const context = createContext({ fundAccountCode: '1111' });

    await context.service.clearCustomerDebt(
      customerId,
      10000,
      userId,
      undefined,
      fundId,
      'BANK',
    );

    expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId,
        fundId,
        reasonCode: 'TNBHTS_BANK',
      }),
      context.manager,
    );
  });

  it('rejects a receipt amount greater than the current debt', async () => {
    const context = createContext();

    await expect(
      context.service.clearCustomerDebt(
        customerId,
        30001,
        userId,
        undefined,
        fundId,
        'CASH',
      ),
    ).rejects.toThrow(
      new BadRequestException('Số tiền trả nợ vượt quá công nợ hiện tại'),
    );

    expect(context.financeService.createMoneyVoucher).not.toHaveBeenCalled();
  });

  it('keeps the existing topup flow independent from debt clearance', async () => {
    const context = createContext({
      balance: -30000,
      fundAccountCode: '1121',
    });

    const result = await context.service.topup(
      customerId,
      50000,
      userId,
      'Nap tien qua MoMo (GD: 123)',
      fundId,
    );

    expect(result.balanceAfter).toBe(20000);
    expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 30000,
        fundId,
        customerId,
      }),
      context.manager,
    );
  });
});
