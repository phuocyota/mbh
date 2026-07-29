import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Fund,
  FundTransaction,
  MoneyVoucher,
  Debt,
  Supplier,
  FundReceiptReceived,
  FundReceiptPaid,
  FundReceiptTransfer,
  FundDetail,
  StockFundReceiptReason,
} from '../../entities';
describe('FinanceService', () => {
  let service: FinanceService;

  const mockRepositories: any = {
    Fund: {
      findOne: jest.fn().mockResolvedValue({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        balance: 1000,
        debit: 500,
        credit: 200,
        name: 'Quỹ Tiền Mặt',
      }),
      find: jest.fn().mockResolvedValue([
        {
          id: 'fund-id-1',
          branchId: 'branch-id-1',
          code: 'TM',
          name: 'Tien mat',
          accountCode: '1111',
          balance: -460000,
        },
        {
          id: 'fund-id-2',
          branchId: 'branch-id-1',
          code: 'NH',
          name: 'Tien gui ngan hang',
          accountCode: '1121',
          balance: 0,
        },
      ]),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    MoneyVoucher: {
      create: jest.fn((data) => ({ id: 'voucher-id-1', ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({ id: 'voucher-id-1', ...entity }),
      ),
      findOne: jest.fn().mockResolvedValue({ id: 'voucher-id-1' }),
      createQueryBuilder: jest.fn(),
    },
    FundTransaction: {
      create: jest.fn((data) => ({ id: 'tx-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    Debt: {
      create: jest.fn((data) => ({ id: 'debt-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    Supplier: {
      findOne: jest.fn().mockResolvedValue({ id: 'supplier-id-1', debt: 100 }),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    FundReceiptReceived: {
      create: jest.fn((data) => ({ id: 'received-id-1', ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({ id: 'received-id-1', ...entity }),
      ),
    },
    FundReceiptPaid: {
      create: jest.fn((data) => ({ id: 'paid-id-1', ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({ id: 'paid-id-1', ...entity }),
      ),
    },
    FundReceiptTransfer: {
      create: jest.fn((data) => ({ id: 'transfer-id-1', ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({ id: 'transfer-id-1', ...entity }),
      ),
      findOne: jest.fn().mockResolvedValue({ id: 'transfer-id-1' }),
    },
    FundDetail: {
      create: jest.fn((data) => ({ id: 'detail-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(),
    },
    StockFundReceiptReason: {
      findOne: jest.fn().mockResolvedValue(null),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepositories.StockFundReceiptReason.findOne.mockResolvedValue({
      code: 'TEST_REASON',
      reason: 'Test accounting reason',
      accountingFormula: '{111:-,511:+}',
      status: 'active',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: getRepositoryToken(Fund),
          useValue: mockRepositories.Fund,
        },
        {
          provide: getRepositoryToken(FundTransaction),
          useValue: mockRepositories.FundTransaction,
        },
        {
          provide: getRepositoryToken(MoneyVoucher),
          useValue: mockRepositories.MoneyVoucher,
        },
        {
          provide: getRepositoryToken(Debt),
          useValue: mockRepositories.Debt,
        },
        {
          provide: getRepositoryToken(Supplier),
          useValue: mockRepositories.Supplier,
        },
        {
          provide: getRepositoryToken(FundReceiptReceived),
          useValue: mockRepositories.FundReceiptReceived,
        },
        {
          provide: getRepositoryToken(FundReceiptPaid),
          useValue: mockRepositories.FundReceiptPaid,
        },
        {
          provide: getRepositoryToken(FundReceiptTransfer),
          useValue: mockRepositories.FundReceiptTransfer,
        },
        {
          provide: getRepositoryToken(FundDetail),
          useValue: mockRepositories.FundDetail,
        },
        {
          provide: getRepositoryToken(StockFundReceiptReason),
          useValue: mockRepositories.StockFundReceiptReason,
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('summary', () => {
    function createSummaryQueryBuilder(rawResult?: any) {
      return {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(rawResult),
        getRawMany: jest.fn().mockResolvedValue(rawResult),
      };
    }

    it('should aggregate received, paid and transfer totals by branch', async () => {
      const baseQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        clone: jest.fn(),
      };
      const totalsQueryBuilder = createSummaryQueryBuilder({
        totalReceived: '1000',
        totalPaid: '350',
        receivedCount: '3',
        paidCount: '2',
      });
      const breakdownQueryBuilder = createSummaryQueryBuilder([
        {
          type: 'RECEIPT',
          category: 'ORDER_PAYMENT',
          count: '3',
          amount: '1000',
        },
        {
          type: 'PAYMENT',
          category: 'STOCK_IMPORT',
          count: '2',
          amount: '350',
        },
      ]);

      baseQueryBuilder.clone
        .mockReturnValueOnce(totalsQueryBuilder)
        .mockReturnValueOnce(breakdownQueryBuilder);
      mockRepositories.MoneyVoucher.createQueryBuilder.mockReturnValue(
        baseQueryBuilder,
      );

      const result = await service.summary('branch-id-1', {
        from: '2026-07-01',
        to: '2026-07-08',
      });

      expect(
        mockRepositories.MoneyVoucher.createQueryBuilder,
      ).toHaveBeenCalledWith('voucher');
      expect(baseQueryBuilder.andWhere).toHaveBeenCalledWith(
        'fund.branchId = :branchId',
        { branchId: 'branch-id-1' },
      );
      expect(baseQueryBuilder.andWhere).toHaveBeenCalledWith(
        'voucher.createdAt >= :from',
        { from: expect.any(Date) },
      );
      expect(baseQueryBuilder.andWhere).toHaveBeenCalledWith(
        'voucher.createdAt <= :to',
        { to: expect.any(Date) },
      );
      expect(result.summary).toEqual({
        totalReceived: 1000,
        totalPaid: 350,
        netAmount: 650,
        receivedCount: 3,
        paidCount: 2,
      });
      expect(result.transfers).toEqual({
        transferIn: 0,
        transferOut: 0,
        netTransfer: 0,
        transferInCount: 0,
        transferOutCount: 0,
      });
      expect(result.balances).toEqual(
        expect.objectContaining({
          cash: -460000,
          deposit: 0,
          total: -460000,
        }),
      );
      expect(result.breakdown).toEqual([
        {
          type: 'RECEIPT',
          category: 'ORDER_PAYMENT',
          count: 3,
          amount: 1000,
        },
        {
          type: 'PAYMENT',
          category: 'STOCK_IMPORT',
          count: 2,
          amount: 350,
        },
      ]);
    });

    it('should filter by voucher type alias', async () => {
      const baseQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        clone: jest.fn(),
      };
      const totalsQueryBuilder = createSummaryQueryBuilder({
        totalReceived: '0',
        totalPaid: '350',
        receivedCount: '0',
        paidCount: '2',
      });
      const breakdownQueryBuilder = createSummaryQueryBuilder([
        {
          type: 'PAYMENT',
          category: 'STOCK_IMPORT',
          count: '2',
          amount: '350',
        },
      ]);

      baseQueryBuilder.clone
        .mockReturnValueOnce(totalsQueryBuilder)
        .mockReturnValueOnce(breakdownQueryBuilder);
      mockRepositories.MoneyVoucher.createQueryBuilder.mockReturnValue(
        baseQueryBuilder,
      );

      const result = await service.summary('branch-id-1', {
        voucherType: 'PC',
      });

      expect(baseQueryBuilder.andWhere).toHaveBeenCalledWith(
        'voucher.type = :voucherType',
        {
          voucherType: 'PAYMENT',
        },
      );
      expect(result.voucherType).toBe('PAID');
      expect(result.summary).toEqual({
        totalReceived: 0,
        totalPaid: 350,
        netAmount: -350,
        receivedCount: 0,
        paidCount: 2,
      });
    });

    it('should require branchId', async () => {
      await expect(service.summary()).rejects.toThrow('branchId is required');
    });

    it('should reject invalid voucher type', async () => {
      await expect(
        service.summary('branch-id-1', { voucherType: 'OTHER' }),
      ).rejects.toThrow('voucherType must be one of');
    });
  });

  describe('createMoneyVoucher (Receipt)', () => {
    it('should resolve fundId from reason accounting formula and branch', async () => {
      const dto = {
        type: 'RECEIPT',
        branchId: 'branch-id-1',
        amount: 200,
        reasonCode: 'TEST_RECEIPT',
      };

      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'TEST_RECEIPT',
        reason: 'Test receipt reason',
        accountingFormula: '{111:-,511:+}',
        status: 'active',
      });

      await service.createMoneyVoucher(dto);

      expect(mockRepositories.Fund.find).toHaveBeenCalledWith({
        where: { branchId: 'branch-id-1', status: 'active' },
      });
      expect(mockRepositories.MoneyVoucher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fundId: 'fund-id-1',
        }),
      );
    });

    it('should create a receipt header and corresponding details, and update fund debit', async () => {
      const dto = {
        type: 'RECEIPT',
        fundId: 'fund-id-1',
        amount: 200,
        orderId: 'order-id-1',
        purpose: 'ORDER_PAYMENT',
        reasonCode: 'TEST_RECEIPT',
        note: 'Customer paid',
      };

      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'TEST_RECEIPT',
        reason: 'Test receipt reason',
        accountingFormula: '{111:-,511:+}',
        status: 'active',
      });
      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        status: 'active',
        balance: 1000,
        debit: 500,
        credit: 200,
      });

      const result = await service.createMoneyVoucher(dto);

      expect(mockRepositories.Fund.save).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: 1000,
          debit: 700,
        }),
      );

      expect(mockRepositories.FundReceiptReceived.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          amount: 200,
          fundId: 'fund-id-1',
          orderId: 'order-id-1',
          status: 'COMPLETED',
          note: 'Customer paid',
        }),
      );

      expect(mockRepositories.FundDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 200,
          type: 'RECEIVED',
          category: 'TEST_RECEIPT',
          fundId: 'fund-id-1',
          receivedId: 'received-id-1',
          note: 'Customer paid',
        }),
      );

      expect(result).toBeDefined();
    });

    it('should reject an explicit fund outside the accounting reason formula', async () => {
      const dto = {
        type: 'RECEIPT',
        fundId: 'fund-id-1',
        amount: 200,
        purpose: 'CUSTOMER_SUPPLIER_DEBT_OFFSET',
        reasonCode: 'BT_CN_KH_NCC',
      };

      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'BT_CN_KH_NCC',
        reason: 'Bu tru cong no khach hang va nha cung cap',
        accountingFormula: '{331:-,131:+}',
      });
      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        status: 'active',
        balance: 1000,
        debit: 500,
        credit: 200,
      });

      await expect(service.createMoneyVoucher(dto)).rejects.toThrow(
        'does not match accounting_formula of reason BT_CN_KH_NCC',
      );
    });
  });

  describe('business fields to accounting reason mapping', () => {
    it('should map receipt/payment methods to reason codes inside BE', async () => {
      const createVoucherSpy = jest
        .spyOn(service, 'createMoneyVoucher')
        .mockResolvedValue({ id: 'voucher-id-1' } as any);

      await service.createReceipt({
        amount: 100,
        paymentMethod: 'CASH',
      });
      await service.createPayment({
        amount: 200,
        paymentMethod: 'BANK_TRANSFER',
      });

      expect(createVoucherSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'RECEIPT',
          paymentMethod: 'CASH',
          reasonCode: 'THU_KHAC_CASH',
        }),
      );
      expect(createVoucherSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'PAYMENT',
          paymentMethod: 'BANK_TRANSFER',
          reasonCode: 'CHI_KHAC_BANK',
        }),
      );

      createVoucherSpy.mockRestore();
    });
  });

  describe('createMoneyVoucher (Payment)', () => {
    it('should create a payment header and corresponding details, and update fund credit', async () => {
      const dto = {
        type: 'PAYMENT',
        fundId: 'fund-id-1',
        amount: 300,
        orderId: 'order-id-1',
        purpose: 'STOCK_IMPORT',
        reasonCode: 'TEST_PAYMENT',
        note: 'Import payment',
      };

      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'TEST_PAYMENT',
        reason: 'Test payment reason',
        accountingFormula: '{111:+,156:-}',
        status: 'active',
      });
      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        status: 'active',
        balance: 1000,
        debit: 500,
        credit: 200,
      });

      const result = await service.createMoneyVoucher(dto);

      expect(mockRepositories.Fund.save).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: 1000,
          credit: 500,
        }),
      );

      expect(mockRepositories.FundReceiptPaid.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          amount: 300,
          fundId: 'fund-id-1',
          orderId: 'order-id-1',
          status: 'COMPLETED',
          note: 'Import payment',
        }),
      );

      expect(mockRepositories.FundDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 300,
          type: 'PAID',
          category: 'TEST_PAYMENT',
          fundId: 'fund-id-1',
          paidId: 'paid-id-1',
          note: 'Import payment',
        }),
      );

      expect(result).toBeDefined();
    });

    it('should create payment when fund balance is zero and post to credit', async () => {
      const dto = {
        type: 'PAYMENT',
        fundId: 'fund-id-1',
        amount: 300,
        purpose: 'STOCK_IMPORT',
        reasonCode: 'TEST_PAYMENT',
        note: 'Import payment',
      };

      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'TEST_PAYMENT',
        reason: 'Test payment reason',
        accountingFormula: '{111:+,156:-}',
        status: 'active',
      });
      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        status: 'active',
        balance: 0,
        debit: 0,
        credit: 0,
      });

      await service.createMoneyVoucher(dto);

      expect(mockRepositories.Fund.save).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: 0,
          credit: 300,
        }),
      );
      expect(mockRepositories.FundTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balanceAfter: 0,
        }),
      );
    });
  });
});
