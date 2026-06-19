import { Test, TestingModule } from '@nestjs/testing';
import { StockVoucherService } from './stock-voucher.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Product,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
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
      update: jest.fn().mockResolvedValue(true),
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
          unitPrice: 100,
          importId: 'import-id',
        }),
      );
      expect(mockRepositories.StockReceiptDetail.save).toHaveBeenCalled();
      expect(mockFinanceService.createMoneyVoucher).toHaveBeenCalled();
      expect(mockRepositories.StockReceiptImport.update).toHaveBeenCalledWith(
        'import-id',
        { moneyVoucherId: 'money-voucher-id' },
      );
      expect(mockRepositories.StockReceiptDetail.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('createExportVoucher', () => {
    it('should create a StockReceiptExport header and corresponding details', async () => {
      const dto = {
        branchId: 'branch-id-2',
        orderId: 'order-id-1',
        fundId: 'fund-id-2',
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
          unitPrice: 150,
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
  });
});
