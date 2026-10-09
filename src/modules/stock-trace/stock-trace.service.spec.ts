import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockTraceService } from './stock-trace.service';
import {
  StockLot,
  StockMovement,
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  Product,
  Supplier,
  Branch,
  ProductRecipe,
  ProductRecipeItem,
  KitchenProductionBatch,
  KitchenOperation,
} from '../../entities';

describe('StockTraceService', () => {
  let service: StockTraceService;
  let mockDataSource: any;
  let mockRepositories: Record<string, any>;

  const mockLot: Partial<StockLot> = {
    id: 'lot-1',
    stockId: 'stock-1',
    productId: 'product-1',
    lotCode: 'LOT-2024-001',
    quantity: 100,
    manufacturedAt: '2024-01-01',
    expiresAt: '2024-06-01',
  };

  const mockProduct: Partial<Product> = {
    id: 'product-1',
    name: 'Test Product',
    productType: 'INGREDIENT',
  };

  const mockMovement: Partial<StockMovement> = {
    id: 'movement-1',
    stockId: 'stock-1',
    productId: 'product-1',
    lotId: 'lot-1',
    referenceId: 'import-1',
    quantity: 100,
  };

  const mockImportReceipt: Partial<StockReceiptImport> = {
    id: 'import-1',
    code: 'NK001',
    fromId: 'supplier-1',
    fromType: 'SUPPLIER',
    totalAmount: 1000,
    status: 'COMPLETED',
  };

  const mockSupplier: Partial<Supplier> = {
    id: 'supplier-1',
    name: 'Test Supplier',
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const createQueryBuilderMock = (defaultResult: any) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(defaultResult?.getMany || []),
      getManyAndCount: jest.fn().mockResolvedValue(defaultResult?.getManyAndCount || [[], 0]),
      getOne: jest.fn().mockResolvedValue(defaultResult?.getOne || null),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(defaultResult?.getRawOne || { totalQuantity: 0 }),
    });

    mockRepositories = {
      stockLotRepository: {
        findOne: jest.fn().mockResolvedValue(mockLot),
        find: jest.fn().mockResolvedValue([mockLot]),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock({
          getMany: [mockLot],
          getManyAndCount: [[mockLot], 1],
          getOne: mockLot,
        })),
      },
      stockMovementRepository: {
        findOne: jest.fn().mockResolvedValue(mockMovement),
        find: jest.fn().mockResolvedValue([mockMovement]),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock({
          getMany: [mockMovement],
          getManyAndCount: [[mockMovement], 1],
          getOne: mockMovement,
          getRawOne: { totalQuantity: 100 },
        })),
      },
      stockReceiptDetailRepository: {
        find: jest.fn().mockResolvedValue([]),
      },
      stockReceiptImportRepository: {
        findOne: jest.fn().mockResolvedValue(mockImportReceipt),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock({
          getMany: [mockImportReceipt],
        })),
      },
      stockReceiptExportRepository: {
        findOne: jest.fn(),
      },
      productRepository: {
        findOne: jest.fn().mockResolvedValue(mockProduct),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
      },
      supplierRepository: {
        findOne: jest.fn().mockResolvedValue(mockSupplier),
      },
      branchRepository: {
        findOne: jest.fn(),
      },
      productRecipeRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((data) => data),
        save: jest.fn((data) => Promise.resolve({ id: 'recipe-1', ...data })),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock({
          getOne: null,
          getManyAndCount: [[], 0],
        })),
      },
      productRecipeItemRepository: {
        create: jest.fn((data) => data),
        save: jest.fn((data) => Promise.resolve(data)),
      },
      kitchenBatchRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock({
          getMany: [],
        })),
      },
      kitchenOperationRepository: {
        findOne: jest.fn(),
      },
    };

    mockDataSource = {
      manager: {
        getRepository: jest.fn((entity: any) => {
          const entityName = entity.name || entity;
          return mockRepositories[
            Object.keys(mockRepositories).find((key) =>
              key.toLowerCase().includes(entityName.toLowerCase().replace('Repository', '')),
            ) || 'stockLotRepository'
          ];
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockTraceService,
        { provide: DataSource, useValue: mockDataSource },
        ...Object.entries(mockRepositories).map(([key, value]) => ({
          provide: getRepositoryToken(key.replace('Repository', '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')),
          useValue: value,
        })),
        // Add explicit repository tokens
        { provide: getRepositoryToken(StockLot), useValue: mockRepositories.stockLotRepository },
        { provide: getRepositoryToken(StockMovement), useValue: mockRepositories.stockMovementRepository },
        { provide: getRepositoryToken(StockReceiptDetail), useValue: mockRepositories.stockReceiptDetailRepository },
        { provide: getRepositoryToken(StockReceiptImport), useValue: mockRepositories.stockReceiptImportRepository },
        { provide: getRepositoryToken(StockReceiptExport), useValue: mockRepositories.stockReceiptExportRepository },
        { provide: getRepositoryToken(Product), useValue: mockRepositories.productRepository },
        { provide: getRepositoryToken(Supplier), useValue: mockRepositories.supplierRepository },
        { provide: getRepositoryToken(Branch), useValue: mockRepositories.branchRepository },
        { provide: getRepositoryToken(ProductRecipe), useValue: mockRepositories.productRecipeRepository },
        { provide: getRepositoryToken(ProductRecipeItem), useValue: mockRepositories.productRecipeItemRepository },
        { provide: getRepositoryToken(KitchenProductionBatch), useValue: mockRepositories.kitchenBatchRepository },
        { provide: getRepositoryToken(KitchenOperation), useValue: mockRepositories.kitchenOperationRepository },
      ],
    }).compile();

    service = module.get<StockTraceService>(StockTraceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLotDetails', () => {
    it('should return lot details with movements', async () => {
      const result = await service.getLotDetails('lot-1');

      expect(result).toBeDefined();
      expect(result.lot).toEqual(mockLot);
      expect(result.product).toEqual(mockProduct);
      expect(result.currentQuantity).toBe(100);
    });
  });

  describe('getProductLots', () => {
    it('should return paginated product lots', async () => {
      const result = await service.getProductLots('product-1', {
        page: 1,
        size: 20,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.total).toBe(1);
    });
  });

  describe('getProductRecipe', () => {
    it('should return null when no recipe exists', async () => {
      const result = await service.getProductRecipe('product-1');

      expect(result).toBeNull();
    });
  });

  describe('getExpiringLots', () => {
    it('should return expiring lots within specified days', async () => {
      const result = await service.getExpiringLots({
        withinDays: 30,
        branchId: 'branch-1',
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });
});
