import { DataSource } from 'typeorm';
import { StockMovementService } from '../stock/stock-movement.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
import { SocketService } from '../socket/socket.service';

describe('StockVoucherService', () => {
  let service: StockVoucherService;

  const mockRepositories: any = {
    Order: {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'order-id-1', orderCode: 'ABC123' }),
    },
    Customer: {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'customer-id-1', branchId: 'branch-id-1' }),
    },
    Supplier: {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'supplier-id-1', branchId: null }),
    },
    StockRequest: {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (entity) => entity),
    },
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
      findOneBy: jest.fn().mockResolvedValue({ id: 'product-id' }),
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

  const mockSocketService = {
    emitKitchenConsumptionUpdated: jest.fn(),
    emitDashboardUpdated: jest.fn(),
  };

  const mockManager: any = {
    getRepository: (entity: any) => mockRepositories[entity.name],
    query: jest.fn().mockResolvedValue([]),
  };
  const mockMovements = {
    lockProducts: jest.fn().mockResolvedValue(undefined),
    normalize: jest.fn(async (_m: any, _p: any, i: any) => Number(i.quantity)),
    change: jest.fn().mockResolvedValue({}),
  };
  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockVoucherService,
        {
          provide: DataSource,
          useValue: { transaction: (fn: any) => fn(mockManager) },
        },
        { provide: StockMovementService, useValue: mockMovements },
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
        {
          provide: SocketService,
          useValue: mockSocketService,
        },
      ],
    }).compile();

    service = module.get<StockVoucherService>(StockVoucherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createImportVoucher', () => {
    it('defaults fresh food expiry from purchase date, persists it, and replays without mutating the request', async () => {
      mockRepositories.Product.findOneBy.mockResolvedValueOnce({
        id: 'product-id-1',
        isFreshFood: true,
      });
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: true,
        accountingFormula: '{152:-,331:+}',
      });
      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        requestId: 'fresh-food-request',
        purchasedAt: '2099-01-28',
        paymentStatus: 'DEBT',
        items: [{ productId: 'product-id-1', quantity: 2, unitPrice: 100 }],
      };
      const first = await service.createImportVoucher(dto);
      expect(
        mockRepositories.StockReceiptDetail.create.mock.calls[0][0][0]
          .inputDetails,
      ).toMatchObject({ purchasedAt: '2099-01-28', expiresAt: '2099-02-04' });
      expect(mockMovements.change).toHaveBeenCalledWith(
        mockManager,
        'stock-id-1',
        'product-id-1',
        2,
        'import-id',
        expect.objectContaining({ expiresAt: '2099-02-04' }),
      );
      expect(dto.items[0]).not.toHaveProperty('expiresAt');
      mockRepositories.StockRequest.findOneBy.mockResolvedValueOnce(
        mockRepositories.StockRequest.save.mock.calls[0][0],
      );
      expect(await service.createImportVoucher(dto)).toEqual(first);
      expect(mockMovements.change).toHaveBeenCalledTimes(1);
    });

    it('applies material product restrictions when selecting the NHNNL reason on a normal import', async () => {
      mockRepositories.Product.findOneBy.mockResolvedValueOnce({
        id: 'product-id-1',
        productType: 'FINISHED_GOOD',
      });
      await expect(
        service.createImportVoucher({
          branchId: 'branch-id-1',
          sourceId: 'supplier-id-1',
          sourceType: 'SUPPLIER',
          reasonCode: 'NHNNL',
          paymentStatus: 'DEBT',
          items: [{ productId: 'product-id-1', quantity: 1, unitPrice: 100 }],
        }),
      ).rejects.toThrow('Chỉ được nhập sản phẩm nguyên liệu hoặc nhiên liệu.');
      expect(mockMovements.change).not.toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.save).not.toHaveBeenCalled();
    });

    it('persists auto serials and replays the same identities without another stock change', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNCC',
        isDebt: true,
        accountingFormula: '{1561:-,331:+}',
      });
      const dto = {
        branchId: 'branch-id-1',
        sourceId: 'supplier-id-1',
        sourceType: 'SUPPLIER',
        requestId: 'serial-request',
        paymentStatus: 'DEBT',
        items: [
          {
            productId: 'product-id-1',
            quantity: 2,
            unitPrice: 100,
            serialMode: 'AUTO' as const,
          },
        ],
      };
      const first = await service.createImportVoucher(dto);
      const created =
        mockRepositories.StockReceiptDetail.create.mock.calls[0][0][0];
      expect(created.inputDetails.serialMode).toBe('AUTO');
      expect(new Set(created.inputDetails.serials).size).toBe(2);
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining("d.input_details->'serials'"),
        ['branch-id-1', 'product-id-1', created.inputDetails.serials],
      );
      const stored = mockRepositories.StockRequest.save.mock.calls[0][0];
      mockRepositories.StockRequest.findOneBy.mockResolvedValueOnce(stored);
      expect(await service.createImportVoucher(dto)).toEqual(first);
      expect(mockMovements.change).toHaveBeenCalledTimes(1);
      expect(mockRepositories.StockReceiptDetail.create).toHaveBeenCalledTimes(
        1,
      );
    });

    it('rejects a serial already imported before writing stock or accounting', async () => {
      // First query locks the branch; second searches its imported serials.
      mockManager.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ exists: 1 }]);
      await expect(
        service.createImportVoucher({
          branchId: 'branch-id-1',
          sourceId: 'supplier-id-1',
          sourceType: 'SUPPLIER',
          paymentStatus: 'DEBT',
          items: [
            {
              productId: 'product-id-1',
              quantity: 1,
              unitPrice: 100,
              serialMode: 'MANUAL',
              serials: [' SN-1 '],
            },
          ],
        }),
      ).rejects.toThrow('Serial đã được nhập');
      expect(mockManager.query).toHaveBeenLastCalledWith(
        expect.stringContaining("d.input_details->'serials'"),
        ['branch-id-1', 'product-id-1', ['SN-1']],
      );
      expect(mockMovements.change).not.toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.save).not.toHaveBeenCalled();
      expect(mockSupplierService.recordPurchaseDebt).not.toHaveBeenCalled();
    });

    it('imports material lots with supplier debt, returns lot identity and replays without increasing stock twice', async () => {
      mockRepositories.Product.findOneBy.mockResolvedValueOnce({
        id: 'product-id-1',
        productType: 'INGREDIENT',
        lotTrackingEnabled: true,
        baseUnitId: 'unit',
        branchId: 'branch-id-1',
      });
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'NHNNL',
        isDebt: true,
        accountingFormula: '{152:-,331:+}',
      });
      mockRepositories.StockReceiptDetail.find.mockResolvedValueOnce([
        {
          id: 'detail-id-1',
          productId: 'product-id-1',
          quantity: 5,
          inputDetails: { lotCode: 'LOT-1' },
        },
      ]);
      mockRepositories.StockLot = {
        findOneByOrFail: jest.fn(async () => ({
          id: 'lot-id-1',
          lotCode: 'LOT-1',
          stockId: 'stock-id-1',
          productId: 'product-id-1',
          quantity: 5,
          manufacturedAt: null,
          expiresAt: '2099-01-01',
        })),
      };
      const dto = {
        branchId: 'branch-id-1',
        supplierId: 'supplier-id-1',
        requestId: '4cb10234-a79e-4bbb-b1dc-fd2abce7a7ba',
        paymentStatus: 'DEBT',
        items: [
          {
            productId: 'product-id-1',
            lotCode: 'LOT-1',
            quantity: 5,
            unitPrice: 100,
            expiresAt: '2099-01-01',
          },
        ],
      };
      const first = await service.createMaterialImport(dto, 'staff');
      expect(
        mockRepositories.StockFundReceiptReason.findOne,
      ).toHaveBeenCalledWith({
        where: { code: 'NHNNL', isDebt: true, status: 'active' },
      });
      expect(first[0]).toMatchObject({
        lot: { id: 'lot-id-1', status: 'IN STOCK' },
      });
      expect(mockMovements.change).toHaveBeenCalledWith(
        mockManager,
        'stock-id-1',
        'product-id-1',
        5,
        'import-id',
        expect.objectContaining({ lotCode: 'LOT-1', actorId: 'staff' }),
      );
      expect(mockSupplierService.recordPurchaseDebt).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 500 }),
        mockManager,
      );
      const stored = mockRepositories.StockRequest.save.mock.calls[0][0];
      mockRepositories.StockRequest.findOneBy.mockResolvedValueOnce(stored);
      expect(await service.createMaterialImport(dto, 'staff')).toEqual(first);
      expect(mockMovements.change).toHaveBeenCalledTimes(1);
      mockRepositories.StockRequest.findOneBy.mockResolvedValueOnce(stored);
      await expect(
        service.createMaterialImport(
          { ...dto, items: [{ ...dto.items[0], quantity: 6 }] },
          'staff',
        ),
      ).rejects.toThrow('IDEMPOTENCY_PAYLOAD_CONFLICT');
    });
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

      const result = await service.createImportVoucher(dto);

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
      expect(mockRepositories.Fund.find).not.toHaveBeenCalled();
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
      expect(mockMovements.change).toHaveBeenCalledWith(
        mockManager,
        'stock-id-1',
        'product-id-1',
        5,
        'import-id',
        expect.objectContaining({ quantity: 5 }),
      );
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYMENT',
          refType: 'STOCK_VOUCHER',
          refId: 'import-id',
          supplierId: 'supplier-id-1',
          branchId: 'branch-id-1',
          fundId: undefined,
          amount: 500,
          reasonCode: 'NHNCC',
        }),
        mockManager,
      );
      expect(result[0].importReceipt.paymentVoucher).toEqual(
        expect.objectContaining({
          id: 'money-voucher-id',
          refId: 'import-id',
        }),
      );
      expect(result[0].importReceipt.paidReceipt).toEqual(
        expect.objectContaining({
          id: 'paid-receipt-id',
          moneyVoucherId: 'money-voucher-id',
        }),
      );
      expect(mockSupplierService.recordPurchase).toHaveBeenCalledWith(
        'supplier-id-1',
        500,
        mockManager,
      );
      expect(mockSupplierService.recordPurchaseDebt).not.toHaveBeenCalled();
      expect(mockSocketService.emitDashboardUpdated).toHaveBeenCalledWith({
        source: 'stock-voucher',
        action: 'IMPORT',
        branchId: 'branch-id-1',
      });
      expect(result).toBeDefined();
    });

    it('should delegate a legacy fund hint to FinanceService for formula validation', async () => {
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

      await service.createImportVoucher(dto);

      expect(mockRepositories.Fund.findOne).not.toHaveBeenCalled();
      expect(mockRepositories.Fund.find).not.toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          fundId: 'fund-id-request',
          reasonCode: 'NHNCC',
        }),
        mockManager,
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

      const result = await service.createImportVoucher(dto);

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
        mockManager,
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

    it('should not fall back to an arbitrary branch fund', async () => {
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

      await service.createImportVoucher(dto);

      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          fundId: undefined,
          reasonCode: 'NHNCC',
        }),
        mockManager,
      );
    });

    it('should propagate accounting formula resolution errors from FinanceService', async () => {
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

      mockFinanceService.createMoneyVoucher.mockRejectedValueOnce(
        new BadRequestException(
          'Expected exactly one active fund matching accounting_formula',
        ),
      );

      await expect(service.createImportVoucher(dto as any)).rejects.toThrow(
        'Expected exactly one active fund matching accounting_formula',
      );
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-1',
          reasonCode: 'NHNCC',
        }),
        mockManager,
      );
    });
  });

  describe('createExportVoucher', () => {
    it('filters sales before pagination and excludes unrelated warehouse transactions', async () => {
      const qb: any = {};
      for (const method of [
        'leftJoinAndSelect',
        'orderBy',
        'skip',
        'take',
        'andWhere',
      ])
        qb[method] = jest.fn().mockReturnValue(qb);
      qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
      mockRepositories.StockReceiptDetail.createQueryBuilder = jest
        .fn()
        .mockReturnValue(qb);
      await service.findAll(2, 100, 'branch-id-1', { salesOnly: true });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'detail.receiptType = :saleType AND exportReceipt.reasonCode IN (:...saleReasons)',
        expect.objectContaining({
          saleType: 'EXPORT',
          saleReasons: expect.arrayContaining(['BH_CASH', 'BH_BANK']),
        }),
      );
      expect(qb.skip).toHaveBeenCalledWith(100);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('exportReceipt.branchId = :branchId'),
        { branchId: 'branch-id-1' },
      );
    });

    const sale = {
      branchId: 'branch-id-1',
      sourceId: 'customer-id-1',
      sourceType: 'CUSTOMER',
      paymentMethod: 'CASH',
      items: [{ productId: 'product-id-2', quantity: 2, unitPrice: 150 }],
    };

    it.each([
      ['CASH', 'BH_CASH'],
      ['BANK_TRANSFER', 'BH_BANK'],
    ])(
      'creates both export and receipt for a %s sale',
      async (paymentMethod, reasonCode) => {
        mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
          code: reasonCode,
        });
        await service.createSaleVoucher({ ...sale, paymentMethod });
        const code =
          mockRepositories.StockReceiptExport.create.mock.calls[0][0].code;
        expect(mockRepositories.StockReceiptExport.create).toHaveBeenCalledWith(
          expect.objectContaining({
            totalAmount: 300,
            reasonCode,
            note: `Xuất bán theo đơn ${code}`,
          }),
        );
        expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'RECEIPT',
            amount: 300,
            reasonCode,
            branchId: 'branch-id-1',
            refId: 'export-id',
            note: `Thu tiền đơn hàng ${code}`,
          }),
          mockManager,
        );
      },
    );

    it('rejects a customer from another branch before writing stock', async () => {
      mockRepositories.Customer.findOneBy.mockResolvedValueOnce({
        id: 'customer-id-1',
        branchId: 'other-branch',
      });
      await expect(service.createSaleVoucher(sale)).rejects.toThrow(
        'Khách hàng không thuộc chi nhánh',
      );
      expect(mockRepositories.StockReceiptExport.save).not.toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).not.toHaveBeenCalled();
    });

    it('rejects a zero-total sale before starting any stock write', () => {
      expect(() =>
        service.createSaleVoucher({
          ...sale,
          items: [{ productId: 'p', quantity: 1, unitPrice: 0 }],
        }),
      ).toThrow(BadRequestException);
      expect(mockRepositories.StockReceiptExport.save).not.toHaveBeenCalled();
    });

    it('propagates receipt failure through the enclosing transaction', async () => {
      mockRepositories.StockFundReceiptReason.findOne.mockResolvedValueOnce({
        code: 'BH_CASH',
      });
      mockFinanceService.createMoneyVoucher.mockRejectedValueOnce(
        new Error('fund unavailable'),
      );
      await expect(service.createSaleVoucher(sale)).rejects.toThrow(
        'fund unavailable',
      );
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalledWith(
        expect.any(Object),
        mockManager,
      );
      expect(mockSocketService.emitDashboardUpdated).not.toHaveBeenCalled();
    });

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

      const result = await service.createExportVoucher(dto);

      expect(mockRepositories.StockReceiptExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-id-2',
          referenceId: 'order-id-1',
          referenceType: 'order',
          totalAmount: 300,
          status: 'COMPLETED',
          note: 'Xuất bán theo đơn ABC123\nGhi chú: Export note',
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
      expect(result[0].exportReceipt.receiptVoucher).toEqual(
        expect.objectContaining({
          id: 'receipt-voucher-id',
          refId: 'order-id-1',
        }),
      );
      expect(result[0].exportReceipt.receivedReceipt).toEqual(
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
