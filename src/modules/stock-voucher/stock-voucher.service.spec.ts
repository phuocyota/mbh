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
  MoneyVoucher,
  FundReceiptPaid,
} from '../../entities';
import { FinanceService } from '../finance/finance.service';
import { SupplierService } from '../supplier/supplier.service';

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
    MoneyVoucher: {
      find: jest.fn().mockResolvedValue([]),
    },
    FundReceiptPaid: {
      find: jest.fn().mockResolvedValue([]),
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

  const mockSupplierService = {
    recordPurchase: jest.fn().mockResolvedValue({}),
    recordPurchaseDebt: jest.fn().mockResolvedValue({}),
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
          provide: getRepositoryToken(MoneyVoucher),
          useValue: mockRepositories.MoneyVoucher,
        },
        {
          provide: getRepositoryToken(FundReceiptPaid),
          useValue: mockRepositories.FundReceiptPaid,
        },
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
        {
          provide: SupplierService,
          useValue: mockSupplierService,
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
      mockRepositories.StockReceiptDetail.find.mockResolvedValueOnce([
        {
          id: 'detail-id',
          quantity: 5,
          importId: 'import-id',
          importReceipt: { id: 'import-id' },
        },
      ]);
      mockRepositories.MoneyVoucher.find.mockResolvedValueOnce([
        {
          id: 'money-voucher-id',
          type: 'PAYMENT',
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
          amount: 500,
        },
      ]);
      mockRepositories.FundReceiptPaid.find.mockResolvedValueOnce([
        {
          id: 'paid-receipt-id',
          code: 'PC001',
          moneyVoucherId: 'money-voucher-id',
          amount: 500,
        },
      ]);

      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        fundId: 'fund-id-1',
        paymentStatus: 'PAID',
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

      const result = await service.createImportVoucher(dto as any);

      expect(mockRepositories.StockReceiptImport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          fromId: 'supplier-id-1',
          fromType: 'SUPPLIER',
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
          toId: 'branch-id-1',
          fromType: 'SUPPLIER',
          toType: 'BRANCH',
          importId: 'import-id',
        }),
      );
      expect(mockRepositories.StockReceiptDetail.save).toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYMENT',
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
          supplierId: 'supplier-id-1',
          amount: 500,
        }),
        mockEntityManager,
      );
      expect((result[0].importReceipt as any).paymentVoucher).toEqual(
        expect.objectContaining({
          id: 'money-voucher-id',
          refId: 'import-id',
        }),
      );
      expect((result[0].importReceipt as any).paidReceipt).toEqual(
        expect.objectContaining({
          id: 'paid-receipt-id',
          moneyVoucherId: 'money-voucher-id',
        }),
      );
      expect(mockSupplierService.recordPurchase).toHaveBeenCalledWith('supplier-id-1', 500, mockEntityManager);
      expect(mockSupplierService.recordPurchaseDebt).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should record supplier debt and not create a payment voucher for unpaid supplier imports', async () => {
      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
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

      const result = await service.createImportVoucher(dto as any);

      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromId: 'supplier-id-1',
          fromType: 'SUPPLIER',
        }),
      );
      expect(mockSupplierService.recordPurchaseDebt).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 'supplier-id-1',
          amount: 500,
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
        }),
        mockEntityManager
      );
      expect(mockSupplierService.recordPurchase).not.toHaveBeenCalled();
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
        sourceId: 'customer-id-1',
        sourceType: 'CUSTOMER',
        referenceId: 'order-id-1',
        referenceType: 'order',
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

      const result = await service.createExportVoucher(dto as any);

      expect(mockRepositories.StockReceiptExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-2',
          referenceId: 'order-id-1',
          referenceType: 'order',
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
          fromId: 'branch-id-2',
          toId: 'customer-id-1',
          fromType: 'BRANCH',
          toType: 'CUSTOMER',
          exportId: 'export-id',
        }),
      );
      expect(mockRepositories.StockReceiptDetail.save).toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalled();
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
          referenceId: 'order-id-advance',
          referenceType: 'order',
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
