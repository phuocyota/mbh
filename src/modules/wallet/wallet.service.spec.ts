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
      debtLimit: 50000,
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
      ...walletRepository,
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
    };
    const financeService = {
      createMoneyVoucher: jest.fn().mockResolvedValue({ id: 'voucher-id' }),
    };
    const socketService = {
      emitCustomerDebtPaid: jest.fn(),
    };

    const service = new WalletService(
      rootWalletRepository as any,
      walletTransactionRepository as any,
      {} as any,
      financeService as any,
      socketService as any,
    );

    return {
      service,
      customer,
      socketService,
      rootWalletRepository,
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

  it.each([
    [0, 50000, 50000, -50000],
    [-45000, 5000, 50000, -50000],
    [10000, 60000, 50000, -50000],
    [10000, 10000, 0, 0],
  ])(
    'charges balance %s by %s within total cap %s',
    async (balance, amount, cap, after) => {
      const context = createContext({ balance });
      context.customer.debtLimit = cap;
      await context.service.chargeForOrder(customerId, amount, 'order-id');
      expect(context.wallet.balance).toBe(after);
      expect(context.customer.debtLimit).toBe(cap);
      expect(context.customerRepository.increment).not.toHaveBeenCalled();
    },
  );

  it.each([
    [-45000, 5001, 50000],
    [-65000, 5000, 50000],
    [0, 1, 0],
    [10000, 60001, 50000],
    [-50000, 1, 90000],
  ])(
    'rejects balance %s charged by %s beyond cap %s without writing money',
    async (balance, amount, cap) => {
      const context = createContext({ balance });
      context.customer.debtLimit = cap;
      await expect(
        context.service.chargeForOrder(customerId, amount, 'order-id'),
      ).rejects.toThrow('Vượt quá tổng nợ cho phép');
      expect(context.wallet.balance).toBe(balance);
      expect(context.walletRepository.save).not.toHaveBeenCalled();
      expect(context.walletTransactionRepository.save).not.toHaveBeenCalled();
    },
  );

  it.each(['CASH', 'BANK'] as const)(
    'accepts partial repayment of 17000 by %s and allows borrowing back to 50000',
    async (paymentMethod) => {
      const context = createContext({ balance: -50000 });
      await context.service.clearCustomerDebt(
        customerId,
        17000,
        userId,
        undefined,
        fundId,
        paymentMethod,
      );
      expect(context.wallet.balance).toBe(-33000);
      expect(context.customer.debtLimit).toBe(50000);
      expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 17000 }),
        context.manager,
      );
      await context.service.chargeForOrder(customerId, 17000, 'order-id');
      expect(context.wallet.balance).toBe(-50000);
      await expect(
        context.service.chargeForOrder(customerId, 1, 'another-order'),
      ).rejects.toThrow('Vượt quá tổng nợ cho phép');
      expect(context.customer.debtLimit).toBe(50000);
    },
  );

  it('accepts 17000 repayment for legacy debt of 65000', async () => {
    const context = createContext({ balance: -65000 });
    await context.service.clearCustomerDebt(
      customerId,
      17000,
      userId,
      undefined,
      fundId,
      'CASH',
    );
    expect(context.wallet.balance).toBe(-48000);
    await context.service.chargeForOrder(customerId, 2000, 'order-id');
    expect(context.wallet.balance).toBe(-50000);
    expect(context.customer.debtLimit).toBe(50000);
  });

  it('does not replenish the cap when refunding debt', async () => {
    const context = createContext({ balance: -65000 });
    await context.service.refundToWallet(
      customerId,
      20000,
      'refund-id',
      'order',
      userId,
    );
    expect(context.wallet.balance).toBe(-45000);
    expect(context.customer.debtLimit).toBe(50000);
    expect(context.customerRepository.increment).not.toHaveBeenCalled();
  });

  it('can buy again after debt is repaid below the fixed cap', async () => {
    const context = createContext({ balance: -65000 });
    await context.service.clearCustomerDebt(
      customerId,
      20000,
      userId,
      undefined,
      fundId,
      'CASH',
    );
    await context.service.chargeForOrder(customerId, 5000, 'new-order');
    expect(context.wallet.balance).toBe(-50000);
    expect(context.customer.debtLimit).toBe(50000);
  });

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
    expect(context.socketService.emitCustomerDebtPaid).toHaveBeenCalledTimes(1);
    expect(context.socketService.emitCustomerDebtPaid).toHaveBeenCalledWith({
      customerId,
      transactionId: result.transactionId,
    });
    expect(result.balanceAfter).toBe(0);
    expect(context.wallet.balance).toBe(0);
    expect(cashRepaymentSpy).toHaveBeenCalledWith(
      customerId,
      30000,
      userId,
      'Thu hồi công nợ',
      fundId,
    );
    expect(context.customerRepository.increment).not.toHaveBeenCalled();
    expect(context.customer.debtLimit).toBe(50000);
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
    expect(context.socketService.emitCustomerDebtPaid).not.toHaveBeenCalled();
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
    expect(context.customerRepository.increment).not.toHaveBeenCalled();
    expect(context.customer.debtLimit).toBe(50000);
    expect(context.socketService.emitCustomerDebtPaid).toHaveBeenCalledTimes(1);
    expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 30000,
        fundId,
        customerId,
      }),
      context.manager,
    );
  });

  it('does not emit for a topup that does not repay debt', async () => {
    const context = createContext({ balance: 10000 });
    await context.service.topup(customerId, 5000, userId);
    expect(context.socketService.emitCustomerDebtPaid).not.toHaveBeenCalled();
  });

  it.each(['CASH', 'BANK'] as const)(
    'emits only after the %s repayment transaction commits',
    async (paymentMethod) => {
      const context = createContext();
      context.rootWalletRepository.manager.transaction.mockImplementation(
        async (callback) => {
          const result = await callback(context.manager);
          expect(
            context.socketService.emitCustomerDebtPaid,
          ).not.toHaveBeenCalled();
          return result;
        },
      );
      await context.service.clearCustomerDebt(
        customerId,
        10000,
        userId,
        undefined,
        undefined,
        paymentMethod,
      );
      expect(context.socketService.emitCustomerDebtPaid).toHaveBeenCalledTimes(
        1,
      );
    },
  );

  it.each(['repayment', 'topup'])(
    'does not emit if the %s transaction fails to commit',
    async (flow) => {
      const context = createContext();
      context.rootWalletRepository.manager.transaction.mockImplementation(
        async (callback) => {
          await callback(context.manager);
          throw new Error('Commit failed');
        },
      );
      const operation =
        flow === 'topup'
          ? context.service.topup(customerId, 10000, userId)
          : context.service.repayDebtByCash(customerId, 10000, userId);
      await expect(operation).rejects.toThrow('Commit failed');
      expect(context.socketService.emitCustomerDebtPaid).not.toHaveBeenCalled();
    },
  );
});
