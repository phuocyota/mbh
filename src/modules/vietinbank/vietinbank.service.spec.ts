import { VietinBankBankTransaction } from '../../entities/vietinbank-bank-transaction.entity';
import {
  VIETINBANK_TOPUP_STATUS,
  VietinBankTopupRequest,
} from '../../entities/vietinbank-topup-request.entity';
import { Customer } from '../../entities/customer.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { VietinBankService } from './vietinbank.service';

describe('VietinBankService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const customerId = '22222222-2222-4222-8222-222222222222';
  const topupId = '33333333-3333-4333-8333-333333333333';
  const requestId = '44444444-4444-4444-8444-444444444444';
  const paymentCode = 'VTBABCDEF123456';
  const branchId = '77777777-7777-4777-8777-777777777777';
  const configId = '88888888-8888-4888-8888-888888888888';
  const accountId = '99999999-9999-4999-8999-999999999999';
  const runtime: any = {
    config: { id: configId, branchId, providerId: '9480', merchantId: '8CAP' },
    account: {
      id: accountId,
      accountNumber: '999999999',
      accountName: 'SMART CANTEEN',
    },
    clientSecret: 'client-secret',
    privateKey: 'private-key',
  };

  const createTopupContext = (balance: number) => {
    const customer = { id: customerId, userId };
    const wallet = {
      id: '55555555-5555-4555-8555-555555555555',
      customerId,
      balance,
      status: 'ACTIVE',
    };
    const savedRequest: any = {
      id: topupId,
      requestId,
      paymentCode,
      customerId,
      branchId,
      vietinBankConfigId: configId,
      vietinBankAccountId: accountId,
      balanceAtCreation: balance,
      targetBalance: 50000,
      amount: Math.max(50000 - balance, 0),
      qrContent: null,
      qrBase64: null,
      bankAccountNumber: '999999999',
      bankAccountName: 'SMART CANTEEN',
      status: VIETINBANK_TOPUP_STATUS.PENDING,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      completedAt: null,
    };
    const customerManagerRepository = {
      findOne: jest.fn().mockResolvedValue(customer),
    };
    const walletManagerRepository = {
      findOne: jest.fn().mockResolvedValue(wallet),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const topupManagerRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((value) => ({ ...savedRequest, ...value })),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Customer) return customerManagerRepository;
        if (entity === Wallet) return walletManagerRepository;
        if (entity === VietinBankTopupRequest) return topupManagerRepository;
        throw new Error(`Unexpected repository ${entity?.name}`);
      }),
    };
    const topupRepository = {
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(savedRequest),
    };
    const gateway = {
      generateQr: jest.fn().mockResolvedValue({
        qrContent: 'mock-qr',
        qrBase64: 'bW9jay1xcg==',
      }),
    };
    const service = new VietinBankService(
      topupRepository as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
      { resolveForBranch: jest.fn().mockResolvedValue(runtime) } as any,
      gateway as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn(service as any, 'expirePendingRequests')
      .mockResolvedValue(undefined);

    return {
      service,
      gateway,
      topupRepository,
      topupManagerRepository,
    };
  };

  it('creates a QR for the difference between 15,000 and 50,000', async () => {
    const context = createTopupContext(15000);

    const result = await context.service.createTopupQr(userId, branchId);

    expect(result.code).toBe('QR_CREATED');
    expect(result.amount).toBe(35000);
    expect(context.gateway.generateQr).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 35000 }),
      runtime,
    );
    expect(context.topupManagerRepository.update).toHaveBeenCalledWith(
      { customerId, status: VIETINBANK_TOPUP_STATUS.PENDING },
      { status: VIETINBANK_TOPUP_STATUS.SUPERSEDED },
    );
  });

  it('does not create a QR when the wallet has reached the target', async () => {
    const context = createTopupContext(50000);

    const result = await context.service.createTopupQr(userId, branchId);

    expect(result.code).toBe('NO_TOPUP_NEEDED');
    expect(result.amount).toBe(0);
    expect(context.gateway.generateQr).not.toHaveBeenCalled();
  });

  it('creates a 60,000 QR when the wallet balance is negative 10,000', async () => {
    const context = createTopupContext(-10000);

    const result = await context.service.createTopupQr(userId, branchId);

    expect(result.amount).toBe(60000);
    expect(context.gateway.generateQr).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 60000 }),
      runtime,
    );
  });

  const createNotifyContext = (balance = 15000, signatureValid = true) => {
    const request: any = {
      id: topupId,
      requestId,
      paymentCode,
      customerId,
      branchId,
      vietinBankConfigId: configId,
      vietinBankAccountId: accountId,
      amount: balance < 0 ? 50000 - balance : 35000,
      status: VIETINBANK_TOPUP_STATUS.PENDING,
      completedAt: null,
      failureReason: null,
    };
    const wallet: any = {
      id: '55555555-5555-4555-8555-555555555555',
      customerId,
      balance,
      status: 'ACTIVE',
    };
    const savedWalletTransaction = {
      id: '66666666-6666-4666-8666-666666666666',
    };
    const topupManagerRepository = {
      findOne: jest.fn().mockResolvedValue(request),
      save: jest.fn(async (value) => value),
    };
    const bankManagerRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const customerManagerRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: customerId,
        customerCode: 'KH001',
        fullName: 'Parent',
      }),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    const walletManagerRepository = {
      findOne: jest.fn().mockResolvedValue(wallet),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const walletTransactionManagerRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(savedWalletTransaction),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === VietinBankTopupRequest) return topupManagerRepository;
        if (entity === VietinBankBankTransaction) return bankManagerRepository;
        if (entity === Customer) return customerManagerRepository;
        if (entity === Wallet) return walletManagerRepository;
        if (entity === WalletTransaction)
          return walletTransactionManagerRepository;
        throw new Error(`Unexpected repository ${entity?.name}`);
      }),
      query: jest
        .fn()
        .mockResolvedValue([
          { branch_id: '77777777-7777-4777-8777-777777777777' },
        ]),
    };
    const topupRepository = {
      findOne: jest.fn().mockResolvedValue(request),
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
    };
    const bankTransactionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const gateway = {
      verifyNotifySignature: jest.fn().mockReturnValue(signatureValid),
      signNotifyResponse: jest.fn().mockReturnValue('SIGNED_RESPONSE'),
    };
    const financeService = {
      createMoneyVoucher: jest.fn().mockResolvedValue({ id: 'voucher-id' }),
    };
    const socketService = { emitCustomerDebtPaid: jest.fn() };
    const service = new VietinBankService(
      topupRepository as any,
      bankTransactionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      { resolveForCallback: jest.fn().mockResolvedValue(runtime) } as any,
      gateway as any,
      financeService as any,
      socketService as any,
    );
    const body: any = {
      msgId: 'MSG001',
      providerId: '9480',
      transId: 'VTB-TRANS-001',
      transTime: '20260922153000',
      custCode: paymentCode,
      sendAcctId: '123456789',
      recvAcctId: '999999999',
      amount: String(request.amount),
      bankTransId: 'BANK-001',
      remark: `NAPTIEN ${paymentCode}`,
      currencyCode: 'VND',
      signature: 'MOCK_SIGNATURE',
    };

    return {
      service,
      body,
      wallet,
      request,
      topupRepository,
      bankTransactionRepository,
      bankManagerRepository,
      customerManagerRepository,
      financeService,
      socketService,
    };
  };

  it('credits the wallet atomically after a valid callback', async () => {
    const context = createNotifyContext();

    const response = await context.service.processNotify(context.body);

    expect(response.errorCode).toBe('00');
    expect(context.wallet.balance).toBe(50000);
    expect(context.bankManagerRepository.save).toHaveBeenCalledTimes(1);
    expect(context.request.status).toBe(VIETINBANK_TOPUP_STATUS.SUCCESS);
  });

  it('does not write data when the callback signature is invalid', async () => {
    const context = createNotifyContext(15000, false);

    const response = await context.service.processNotify(context.body);

    expect(response.errorCode).toBe('01');
    expect(context.topupRepository.manager.transaction).not.toHaveBeenCalled();
    expect(context.wallet.balance).toBe(15000);
  });

  it('does not credit the wallet when the callback amount differs from the QR', async () => {
    const context = createNotifyContext();
    context.body.amount = '34000';

    const response = await context.service.processNotify(context.body);

    expect(response.errorCode).toBe('03');
    expect(context.topupRepository.manager.transaction).not.toHaveBeenCalled();
    expect(context.wallet.balance).toBe(15000);
  });

  it('still credits a superseded QR when the bank confirms real money', async () => {
    const context = createNotifyContext();
    context.request.status = VIETINBANK_TOPUP_STATUS.SUPERSEDED;

    const response = await context.service.processNotify(context.body);

    expect(response.errorCode).toBe('00');
    expect(context.wallet.balance).toBe(50000);
    expect(context.request.status).toBe(VIETINBANK_TOPUP_STATUS.SUCCESS);
  });

  it('restores debt allowance and emits only after a bank topup commits', async () => {
    const context = createNotifyContext(-10000);
    const response = await context.service.processNotify(context.body);

    expect(response.errorCode).toBe('00');
    expect(context.customerManagerRepository.increment).toHaveBeenCalledWith(
      { id: customerId },
      'debtLimit',
      10000,
    );
    expect(context.financeService.createMoneyVoucher).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000, reasonCode: 'TNBHTS_BANK' }),
      expect.anything(),
    );
    expect(context.socketService.emitCustomerDebtPaid).toHaveBeenCalledTimes(1);
  });

  it('returns success for an identical retry without another transaction', async () => {
    const context = createNotifyContext();
    context.bankTransactionRepository.findOne.mockResolvedValue({
      transId: context.body.transId,
      bankTransId: context.body.bankTransId,
      paymentCode,
      recvAccountId: context.body.recvAcctId,
      amount: Number(context.body.amount),
      currency: 'VND',
    });

    const response = await context.service.processNotify(context.body);

    expect(response.errorCode).toBe('00');
    expect(context.topupRepository.manager.transaction).not.toHaveBeenCalled();
  });
});
