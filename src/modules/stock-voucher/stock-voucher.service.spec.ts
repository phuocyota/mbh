import { Test, TestingModule } from '@nestjs/testing';
import { StockVoucherService } from './stock-voucher.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Product,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  Stock,
  StockItem,
  StockFundReceiptReason,
  Supplier,
  Debt,
} from '../../entities';
import { FinanceService } from '../finance/finance.service';

describe('StockVoucherService', () => {
  let service: StockVoucherService;

  const mockRepositories: any = {
    StockReceiptDetail: {
      create: jest.fn((data) => ({ id: 'detail-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(true),
      find: jest.fn().mockResolvedValue([{ id: 'detail-id', quantity: 5 }]),
    },
    Product: {
      findOne: jest.fn().mockResolvedValue({ id: 'product-id', quantity: 10 }),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    StockReceiptImport: {
      create: jest.fn((data) => ({ id: 'import-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(true),
    },
    StockReceiptExport: {
      create: jest.fn((data) => ({ id: 'export-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(true),
    },
    StockReceiptTransfer: {
      create: jest.fn((data) => ({ id: 'transfer-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(true),
    },
    Stock: {
      findOne: jest.fn().mockResolvedValue({ id: 'stock-id-1', branchId: 'branch-id-1' }),
      create: jest.fn((data) => ({ id: 'stock-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    StockItem: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ id: 'stock-item-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    StockFundReceiptReason: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    Supplier: {
      findOne: jest.fn().mockImplementation(() => Promise.resolve({
        id: 'supplier-id-1',
        debt: 0,
        totalPurchase: 0,
      })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    Debt: {
      create: jest.fn((data) => ({ id: 'debt-id-1', ...data })),
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

  const mockFinanceService = {
    createMoneyVoucher: jest.fn().mockResolvedValue({ id: 'money-voucher-id' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockVoucherService,
        {
          provide: getRepositoryToken(StockReceiptDetail),
          useValue: mockRepositories.StockReceiptDetail,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepositories.Product,
        },
        {
          provide: getRepositoryToken(StockReceiptImport),
          useValue: mockRepositories.StockReceiptImport,
        },
        {
          provide: getRepositoryToken(StockReceiptExport),
          useValue: mockRepositories.StockReceiptExport,
        },
        {
          provide: getRepositoryToken(StockReceiptTransfer),
          useValue: mockRepositories.StockReceiptTransfer,
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: mockRepositories.Stock,
        },
        {
          provide: getRepositoryToken(StockItem),
          useValue: mockRepositories.StockItem,
        },
        {
          provide: getRepositoryToken(StockFundReceiptReason),
          useValue: mockRepositories.StockFundReceiptReason,
        },
        {
          provide: getRepositoryToken(Supplier),
          useValue: mockRepositories.Supplier,
        },
        {
          provide: getRepositoryToken(Debt),
          useValue: mockRepositories.Debt,
        },
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<StockVoucherService>(StockVoucherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createImportVoucher', () => {
    it('should create a StockReceiptImport header and corresponding details', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        accountingFormula: '{1561:-,1111:+,1331:-}',
      });

      const dto = {
        branchId: 'branch-id-1',
        supplierId: 'supplier-id-1',
        fundId: 'fund-id-1',
        note: 'Import note',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
            note: 'Item note',
          },
        ],
      };

      const result = await service.createImportVoucher(dto);

      expect(mockRepositories.StockReceiptImport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          supplierId: 'supplier-id-1',
          fundId: 'fund-id-1',
          totalAmount: 500,
          status: 'COMPLETED',
        }),
      );
      expect(mockRepositories.StockReceiptImport.save).toHaveBeenCalled();
      expect(mockRepositories.StockReceiptDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'product-id-1',
          quantity: 5,
          receiptType: 'IMPORT',
          fromId: 'supplier-id-1',
          toId: 'stock-id-1',
          fromType: 'VENDOR',
          toType: 'STOCK',
          importId: 'import-id',
        }),
      );
      expect(mockRepositories.StockReceiptDetail.save).toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.update).toHaveBeenCalledWith(
        'import-id',
        { moneyVoucherId: 'money-voucher-id' },
      );
      expect(mockRepositories.Debt.save).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should record supplier debt and not create a payment voucher for unpaid supplier imports', async () => {
      const dto = {
        branchId: 'branch-id-1',
        supplierId: 'supplier-id-1',
        fundId: 'fund-id-1',
        paymentStatus: 'DEBT',
        note: 'Import debt note',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      };

      const result = await service.createImportVoucher(dto);

      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fundId: undefined,
        }),
      );
      expect(mockRepositories.Debt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 'supplier-id-1',
          type: 'PURCHASE',
          amount: 500,
          balanceAfter: 500,
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
        }),
      );
      expect(mockRepositories.Debt.save).toHaveBeenCalled();
      expect(mockRepositories.Supplier.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'supplier-id-1',
          debt: 500,
          totalPurchase: 500,
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('createExportVoucher', () => {
    it('should create a StockReceiptExport header and corresponding details', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'BH_CASH',
        accountingFormula: '{1111:-,5111:+,33311:+}',
      });

      const dto = {
        branchId: 'branch-id-2',
        orderId: 'order-id-1',
        fundId: 'fund-id-2',
        reasonCode: 'BH_CASH',
        note: 'Export note',
        items: [
          {
            productId: 'product-id-2',
            quantity: 2,
            unitPrice: 150,
            note: 'Item note 2',
          },
        ],
      };

      const result = await service.createExportVoucher(dto);

      expect(mockRepositories.StockReceiptExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-2',
          orderId: 'order-id-1',
          fundId: 'fund-id-2',
          totalAmount: 300,
          status: 'COMPLETED',
        }),
      );
      expect(mockRepositories.StockReceiptExport.save).toHaveBeenCalled();
      expect(mockRepositories.StockReceiptDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'product-id-2',
          quantity: 2,
          receiptType: 'EXPORT',
          fromId: 'stock-id-1',
          toId: 'order-id-1',
          fromType: 'STOCK',
          toType: 'VENDOR',
          exportId: 'export-id',
        }),
      );
      expect(mockRepositories.StockReceiptDetail.save).toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalled();
      expect(mockRepositories.StockReceiptExport.update).toHaveBeenCalledWith(
        'export-id',
        { moneyVoucherId: 'money-voucher-id' },
      );
      expect(result).toBeDefined();
    });

    it('should clear a customer advance wallet payment without creating another fund receipt', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'BH_TRA_CHAM',
        accountingFormula: '{131:-,5111:+,33311:+,3387:+}',
      });

      const order = {
        id: 'order-id-advance',
        branchId: 'branch-id-1',
        orderCode: 'ORD-ADVANCE',
        totalAmount: 300,
        items: [
          {
            productId: 'product-id-2',
            quantity: 2,
            unitPrice: 150,
            productName: 'Meal',
          },
        ],
      };

      const payment = {
        method: 'WALLET',
        amount: 300,
      };

      const result = await service.createExportFromOrder(order, payment);

      expect(mockRepositories.StockReceiptExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          orderId: 'order-id-advance',
          fundId: undefined,
          totalAmount: 300,
          status: 'COMPLETED',
        }),
      );
      expect(mockRepositories.StockFundReceiptReason.findOne).toHaveBeenCalledWith({
        where: {
          code: 'BH_TRA_CHAM',
        },
      });
      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
