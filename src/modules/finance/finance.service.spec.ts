import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
} from '../../entities';
import { MONEY_VOUCHER_TYPE } from '../../../packages/accounting/src/index.js';

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
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    MoneyVoucher: {
      create: jest.fn((data) => ({ id: 'voucher-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'voucher-id-1', ...entity })),
      findOne: jest.fn().mockResolvedValue({ id: 'voucher-id-1' }),
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
      save: jest.fn((entity) => Promise.resolve({ id: 'received-id-1', ...entity })),
    },
    FundReceiptPaid: {
      create: jest.fn((data) => ({ id: 'paid-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'paid-id-1', ...entity })),
    },
    FundReceiptTransfer: {
      create: jest.fn((data) => ({ id: 'transfer-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'transfer-id-1', ...entity })),
      findOne: jest.fn().mockResolvedValue({ id: 'transfer-id-1' }),
    },
    FundDetail: {
      create: jest.fn((data) => ({ id: 'detail-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
  };

  const mockEntityManager = {
    getRepository: jest.fn().mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : entity;
      return mockRepositories[name];
    }),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMoneyVoucher (Receipt)', () => {
    it('should create a receipt header and corresponding details, and update fund debit', async () => {
      const dto = {
        type: 'RECEIPT',
        fundId: 'fund-id-1',
        amount: 200,
        orderId: 'order-id-1',
        purpose: 'ORDER_PAYMENT',
        note: 'Customer paid',
      };

      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        balance: 1000,
        debit: 500,
        credit: 200,
      });

      const result = await service.createMoneyVoucher(dto);

      expect(mockRepositories.Fund.save).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: 1200,
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
          category: 'ORDER_PAYMENT',
          fundId: 'fund-id-1',
          receivedId: 'received-id-1',
          note: 'Customer paid',
        }),
      );

      expect(result).toBeDefined();
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
        note: 'Import payment',
      };

      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-1',
        branchId: 'branch-id-1',
        accountCode: '1111',
        balance: 1000,
        debit: 500,
        credit: 200,
      });

      const result = await service.createMoneyVoucher(dto);

      expect(mockRepositories.Fund.save).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: 700,
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
          category: 'STOCK_IMPORT',
          fundId: 'fund-id-1',
          paidId: 'paid-id-1',
          note: 'Import payment',
        }),
      );

      expect(result).toBeDefined();
    });
  });

  describe('createTransfer', () => {
    it('should perform a double-entry fund transfer, update balances, and create CQ voucher details', async () => {
      const dto = {
        fromFundId: 'fund-id-1',
        toFundId: 'fund-id-2',
        amount: 400,
        note: 'Transfer to deposit fund',
      };

      const fromFund = {
        id: 'fund-id-1',
        name: 'Quỹ Tiền Mặt',
        balance: 1000,
        credit: 200,
      };

      const toFund = {
        id: 'fund-id-2',
        name: 'Quỹ Ngân Hàng',
        balance: 500,
        debit: 100,
      };

      mockRepositories.Fund.findOne
        .mockResolvedValueOnce(fromFund)
        .mockResolvedValueOnce(toFund);

      const result = await service.createTransfer(dto);

      expect(mockRepositories.Fund.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: 'fund-id-1',
          balance: 600,
          credit: 600,
        }),
      );

      expect(mockRepositories.Fund.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: 'fund-id-2',
          balance: 900,
          debit: 500,
        }),
      );

      expect(mockRepositories.FundReceiptTransfer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 400,
          fromFundId: 'fund-id-1',
          toFundId: 'fund-id-2',
          note: 'Transfer to deposit fund',
          status: 'COMPLETED',
        }),
      );

      expect(mockRepositories.FundDetail.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          amount: 400,
          type: 'PAID',
          category: 'TRANSFER',
          fundId: 'fund-id-1',
          transferId: 'transfer-id-1',
          note: 'Transfer to deposit fund',
        }),
      );

      expect(mockRepositories.FundDetail.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          amount: 400,
          type: 'RECEIVED',
          category: 'TRANSFER',
          fundId: 'fund-id-2',
          transferId: 'transfer-id-1',
          note: 'Transfer to deposit fund',
        }),
      );

      expect(result).toBeDefined();
    });
  });
});
