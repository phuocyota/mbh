import { Test, TestingModule } from '@nestjs/testing';
import { StockVoucherService } from './stock-voucher.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  Product,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  Stock,
  StockItem,
  StockFundReceiptReason,
  Fund,
  MoneyVoucher,
  FundReceiptPaid,
  FundReceiptReceived,
} from '../../entities';
import { FinanceService } from '../finance/finance.service';
import { SupplierService } from '../supplier/supplier.service';
import { StockService } from '../stock/stock.service';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';

describe('StockVoucherService', () => {
  let service: StockVoucherService;

  const mockRepositories: any = {
    StockReceiptDetail: {
      create: jest.fn((data) =>
        Array.isArray(data)
          ? data.map((item, index) => ({
              id: `detail-id-${index + 1}`,
              ...item,
            }))
          : { id: 'detail-id', ...data },
      ),
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
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'stock-id-1', branchId: 'branch-id-1' }),
      create: jest.fn((data) => ({ id: 'stock-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    },
    StockItem: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ id: 'stock-item-id-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      })),
    },
    StockFundReceiptReason: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    Fund: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    },
    MoneyVoucher: {
      find: jest.fn().mockResolvedValue([]),
    },
    FundReceiptPaid: {
      find: jest.fn().mockResolvedValue([]),
    },
    FundReceiptReceived: {
      find: jest.fn().mockResolvedValue([]),
    },
  };

  const mockFinanceService = {
    createMoneyVoucher: jest.fn().mockResolvedValue({ id: 'money-voucher-id' }),
  };

  const mockSupplierService = {
    recordPurchase: jest.fn().mockResolvedValue({}),
    recordPurchaseDebt: jest.fn().mockResolvedValue({}),
  };

  const mockStockService = {
    getOrCreateBranchStock: jest
      .fn()
      .mockResolvedValue({ id: 'stock-id-1', branchId: 'branch-id-1' }),
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
          provide: getRepositoryToken(Fund),
          useValue: mockRepositories.Fund,
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
          provide: getRepositoryToken(FundReceiptReceived),
          useValue: mockRepositories.FundReceiptReceived,
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
          provide: StockService,
          useValue: mockStockService,
        },
      ],
    }).compile();

    service = module.get<StockVoucherService>(StockVoucherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createImportVoucher', () => {
    it('should create a paid supplier import without request fundId or reasonCode', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: false,
        accountingFormula: '{1561:-,1111:+,1331:-}',
      });
      mockRepositories.Fund.find.mockResolvedValueOnce([
        {
          id: 'fund-id-1',
          code: '1111',
          branchId: 'branch-id-1',
          status: 'active',
        },
      ]);
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
          reasonCode: 'NHNCC',
          paymentStatus: 'PAID',
          totalAmount: 500,
          status: 'COMPLETED',
        }),
      );
      expect(
        mockRepositories.StockFundReceiptReason.findOne,
      ).toHaveBeenCalledWith({
        where: {
          code: 'NHNCC',
          isDebt: false,
          status: 'active',
        },
      });
      expect(mockRepositories.Fund.find).toHaveBeenCalledWith({
        where: [
          {
            code: expect.anything(),
            branchId: 'branch-id-1',
            status: 'active',
          },
          {
            accountCode: expect.anything(),
            branchId: 'branch-id-1',
            status: 'active',
          },
        ],
      });
      expect(mockRepositories.StockReceiptImport.save).toHaveBeenCalled();
      expect(mockRepositories.StockReceiptDetail.create).toHaveBeenCalledWith(
        expect.arrayContaining([
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
        ]),
      );
      expect(mockRepositories.StockReceiptDetail.save).toHaveBeenCalled();
      expect(mockRepositories.StockItem.createQueryBuilder).toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYMENT',
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
          supplierId: 'supplier-id-1',
          fundId: 'fund-id-1',
          amount: 500,
          reasonCode: 'NHNCC',
        }),
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
      expect(mockSupplierService.recordPurchase).toHaveBeenCalledWith(
        'supplier-id-1',
        500,
      );
      expect(mockSupplierService.recordPurchaseDebt).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should use request fundId for paid supplier import before resolving from reason formula', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: false,
        accountingFormula: '{1561:-,1111:+,1331:-}',
      });
      mockRepositories.Fund.findOne.mockResolvedValueOnce({
        id: 'fund-id-request',
        branchId: 'branch-id-1',
        status: 'active',
      });
      mockRepositories.StockReceiptDetail.find.mockResolvedValueOnce([
        {
          id: 'detail-id',
          quantity: 5,
          importId: 'import-id',
          importReceipt: { id: 'import-id' },
        },
      ]);

      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PAID',
        fundId: 'fund-id-request',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      };

      await service.createImportVoucher(dto as any);

      expect(mockRepositories.Fund.findOne).toHaveBeenCalledWith({
        where: {
          id: 'fund-id-request',
          branchId: 'branch-id-1',
          status: 'active',
        },
      });
      expect(mockRepositories.Fund.find).not.toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          fundId: 'fund-id-request',
          reasonCode: 'NHNCC',
        }),
      );
    });

    it('should record supplier debt and not create a payment voucher for unpaid supplier imports', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: true,
        accountingFormula: '{1561:-,331:+}',
      });

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
      expect(
        mockRepositories.StockFundReceiptReason.findOne,
      ).toHaveBeenCalledWith({
        where: {
          code: 'NHNCC',
          isDebt: true,
          status: 'active',
        },
      });
      expect(mockRepositories.Fund.find).not.toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromId: 'supplier-id-1',
          fromType: 'SUPPLIER',
          reasonCode: 'NHNCC',
          paymentStatus: 'DEBT',
        }),
      );
      expect(mockSupplierService.recordPurchaseDebt).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 'supplier-id-1',
          amount: 500,
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
        }),
      );
      expect(mockSupplierService.recordPurchase).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should fail paid supplier imports when the paid reason is not configured', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce(
        null,
      );

      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PAID',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      };

      await expect(service.createImportVoucher(dto as any)).rejects.toThrow(
        'Active supplier import reason is not configured: code=NHNCC, isDebt=false',
      );
      expect(mockRepositories.StockReceiptImport.save).not.toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
    });

    it('should require an explicit supplier import paymentStatus', async () => {
      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      };

      await expect(service.createImportVoucher(dto as any)).rejects.toThrow(
        'paymentStatus must be PAID, UNPAID or DEBT for supplier import',
      );
      expect(
        mockRepositories.StockFundReceiptReason.findOne,
      ).not.toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.save).not.toHaveBeenCalled();
    });

    it('should use the only active branch fund when reason formula does not match a fund', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: false,
        accountingFormula: '{1561:-,1111:+,1331:-}',
      });
      mockRepositories.Fund.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'branch-fund-id',
            branchId: 'branch-id-1',
            status: 'active',
          },
        ]);
      mockRepositories.StockReceiptDetail.find.mockResolvedValueOnce([
        {
          id: 'detail-id',
          quantity: 5,
          importId: 'import-id',
          importReceipt: { id: 'import-id' },
        },
      ]);

      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PAID',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      };

      await service.createImportVoucher(dto as any);

      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          fundId: 'branch-fund-id',
          reasonCode: 'NHNCC',
        }),
      );
    });

    it('should require fundId when neither reason formula nor branch fund is unique', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: false,
        accountingFormula: '{1561:-,1111:+,1331:-}',
      });
      mockRepositories.Fund.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'fund-id-1', branchId: 'branch-id-1', status: 'active' },
          { id: 'fund-id-2', branchId: 'branch-id-1', status: 'active' },
        ]);

      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PAID',
        items: [
          {
            productId: 'product-id-1',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      };

      await expect(service.createImportVoucher(dto as any)).rejects.toThrow(
        'fundId is required for paid supplier import in branch branch-id-1',
      );
      expect(mockRepositories.StockReceiptImport.save).not.toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
    });
  });

  describe('createExportVoucher', () => {
    it('should create a StockReceiptExport header and corresponding details', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'BH_CASH',
        accountingFormula: '{1111:-,5111:+,33311:+}',
      });
      mockRepositories.StockReceiptDetail.find.mockResolvedValueOnce([
        {
          id: 'detail-id',
          quantity: 2,
          exportId: 'export-id',
          exportReceipt: {
            id: 'export-id',
            referenceId: 'order-id-1',
            referenceType: 'order',
          },
        },
      ]);
      mockRepositories.MoneyVoucher.find.mockResolvedValueOnce([
        {
          id: 'receipt-voucher-id',
          type: 'RECEIPT',
          refType: 'ORDER',
          refId: 'order-id-1',
          orderId: 'order-id-1',
          amount: 300,
        },
      ]);
      mockRepositories.FundReceiptReceived.find.mockResolvedValueOnce([
        {
          id: 'received-receipt-id',
          code: 'PT001',
          moneyVoucherId: 'receipt-voucher-id',
          amount: 300,
        },
      ]);

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
      expect((result[0].exportReceipt as any).receiptVoucher).toEqual(
        expect.objectContaining({
          id: 'receipt-voucher-id',
          refId: 'order-id-1',
        }),
      );
      expect((result[0].exportReceipt as any).receivedReceipt).toEqual(
        expect.objectContaining({
          id: 'received-receipt-id',
          moneyVoucherId: 'receipt-voucher-id',
        }),
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
          referenceId: 'order-id-advance',
          referenceType: 'order',
          totalAmount: 300,
          status: 'COMPLETED',
        }),
      );
      expect(
        mockRepositories.StockFundReceiptReason.findOne,
      ).toHaveBeenCalledWith({
        where: {
          code: 'BH_TRA_CHAM',
        },
      });
      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('CreateStockVoucherDto validation', () => {
    it('should require sourceId or toId for supplier imports', async () => {
      const dto = plainToInstance(CreateStockVoucherDto, {
        type: 'IMPORT',
        branchId: '11111111-1111-4111-8111-111111111111',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PAID',
        items: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      });

      const errors = await validate(dto);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'sourceId',
            constraints: expect.objectContaining({
              requireSupplierImportSourceId:
                'Supplier sourceId is required for supplier import',
            }),
          }),
        ]),
      );
    });

    it('should reject duplicate item productId before reaching the service', async () => {
      const dto = plainToInstance(CreateStockVoucherDto, {
        type: 'IMPORT',
        branchId: '11111111-1111-4111-8111-111111111111',
        sourceId: '22222222-2222-4222-8222-222222222222',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PAID',
        items: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 100,
          },
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 3,
            unitPrice: 120,
          },
        ],
      });

      const errors = await validate(dto);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'items',
            constraints: expect.objectContaining({
              uniqueStockVoucherItemProducts:
                'items must not contain duplicate productId',
            }),
          }),
        ]),
      );
    });

    it('should require paymentStatus for supplier imports before reaching the service', async () => {
      const dto = plainToInstance(CreateStockVoucherDto, {
        type: 'IMPORT',
        branchId: '11111111-1111-4111-8111-111111111111',
        sourceId: '22222222-2222-4222-8222-222222222222',
        sourceType: 'SUPPLIER',
        items: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      });

      const errors = await validate(dto);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'paymentStatus',
            constraints: expect.objectContaining({
              requireSupplierImportPaymentStatus:
                'paymentStatus must be PAID, UNPAID or DEBT for supplier import',
            }),
          }),
        ]),
      );
    });

    it('should reject invalid paymentStatus values before reaching the service', async () => {
      const dto = plainToInstance(CreateStockVoucherDto, {
        type: 'IMPORT',
        branchId: '11111111-1111-4111-8111-111111111111',
        sourceId: '22222222-2222-4222-8222-222222222222',
        sourceType: 'SUPPLIER',
        paymentStatus: 'PARTIAL',
        items: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      });

      const errors = await validate(dto);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'paymentStatus',
            constraints: expect.objectContaining({
              requireSupplierImportPaymentStatus:
                'paymentStatus must be PAID, UNPAID or DEBT for supplier import',
            }),
          }),
        ]),
      );
    });

    it('should normalize paymentStatus through ValidationPipe transform', async () => {
      const dto = plainToInstance(CreateStockVoucherDto, {
        type: 'IMPORT',
        branchId: '11111111-1111-4111-8111-111111111111',
        sourceId: '22222222-2222-4222-8222-222222222222',
        sourceType: 'SUPPLIER',
        paymentStatus: 'paid',
        items: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            quantity: 5,
            unitPrice: 100,
          },
        ],
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.paymentStatus).toBe('PAID');
    });
  });
});
