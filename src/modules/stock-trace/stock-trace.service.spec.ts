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
  Stock,
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
      stockRepository: {
        findOne: jest.fn(),
        createQueryBuilder: jest.fn(() => createQueryBuilderMock({
          getMany: [],
        })),
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
      query: jest.fn(async (_sql, args) => [{ kind: 'LOT', id: args[0] || args[1] }]),
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
        { provide: getRepositoryToken(Stock), useValue: mockRepositories.stockRepository },
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

  describe('receipt time in lot origin', () => {
    it('returns the selected lot purchase time without borrowing another lot time', async () => {
      mockRepositories.stockReceiptDetailRepository.find.mockResolvedValue([
        { inputDetails: { lotCode: 'OTHER', purchasedAt: '2026-10-20T08:00+07:00' } },
        { inputDetails: { lotCode: mockLot.lotCode, purchasedAt: '2026-10-20T14:35+07:00' } },
      ]);
      const origin = await (service as any).resolveOrigin(mockLot, [mockMovement]);
      expect(origin.purchasedAt).toBe('2026-10-20T14:35+07:00');
      expect(mockRepositories.stockReceiptDetailRepository.find).toHaveBeenCalledWith({
        where: { importId: 'import-1', productId: 'product-1', receiptType: 'IMPORT' },
      });
    });
    it('keeps legacy date precision and does not invent missing purchase time', async () => {
      mockRepositories.stockReceiptDetailRepository.find.mockResolvedValue([
        { inputDetails: { lotCode: mockLot.lotCode, purchasedAt: '2026-10-20' } },
      ]);
      expect((await (service as any).resolveOrigin(mockLot, [mockMovement])).purchasedAt).toBe('2026-10-20');
      mockRepositories.stockReceiptDetailRepository.find.mockResolvedValue([]);
      expect((await (service as any).resolveOrigin(mockLot, [mockMovement])).purchasedAt).toBeNull();
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
  describe('public full trace for materials and cooked portions', () => {
    const setupBatch = (imageUrl: string | null = '/uploads/actual.jpg') => {
      const batch = {
        id: 'batch-1',
        productId: 'dish',
        status: 'COMPLETED',
        actualQuantity: 50,
        startedAt: new Date('2026-10-20T02:00:00Z'),
        readyAt: new Date('2026-10-20T02:30:00Z'),
        completedAt: new Date('2026-10-20T02:31:00Z'),
        details: {
          imageUrl,
          servingExpiresAt: '2026-10-20T04:30:00Z',
          actualLots: [{ lotId: 'food', used: 4, waste: 1 }],
        },
      };
      mockDataSource.query.mockImplementation(async () => [{ kind: 'BATCH', id: batch.id, batchId: batch.id }]);
      mockRepositories.kitchenBatchRepository.findOne.mockResolvedValue(batch);
      mockRepositories.productRepository.findOne.mockImplementation(
        async ({ where }) =>
          where.id === 'dish'
            ? {
                id: 'dish',
                name: 'Cơm thịt kho trứng',
                productType: 'FINISHED_GOOD',
                imageUrl: '/uploads/illustration.jpg',
              }
            : {
                id: where.id,
                name: where.id,
                productType: where.id === 'fuel' ? 'FUEL' : 'INGREDIENT',
              },
      );
      mockRepositories.stockLotRepository.findOne.mockImplementation(
        async ({ where }) => ({
          id: where.id,
          lotCode: where.id,
          productId: where.id,
        }),
      );
      mockRepositories.stockMovementRepository.find.mockImplementation(
        async ({ where }) =>
          where.referenceId
            ? [
                { lotId: 'food', quantity: -6 },
                { lotId: 'food', quantity: 1 },
                { lotId: 'fuel', quantity: -2 },
                { lotId: 'returned', quantity: -3 },
                { lotId: 'returned', quantity: 3 },
              ]
            : [
                {
                  lotId: where.lotId,
                  quantity: 10,
                  referenceId: `receipt-${where.lotId}`,
                },
              ],
      );
      mockRepositories.stockReceiptImportRepository.findOne.mockImplementation(
        async ({ where }) => ({
          id: where.id,
          fromType: 'SUPPLIER',
          createdAt: new Date(
            where.id === 'receipt-food'
              ? '2026-10-19T01:00:00Z'
              : '2026-10-18T01:00:00Z',
          ),
        }),
      );
      mockRepositories.stockReceiptDetailRepository.find.mockImplementation(
        async ({ where }) => [
          {
            inputDetails: {
              lotCode: where.productId,
              purchasedAt:
                where.productId === 'food' ? '2026-10-18' : '2026-10-17',
            },
          },
        ],
      );
      return batch;
    };
    it('exposes receipt time separately from purchase time for ingredients', async () => {
      mockRepositories.stockReceiptImportRepository.findOne.mockResolvedValue({
        ...mockImportReceipt,
        createdAt: new Date('2026-10-19T01:00:00Z'),
      });
      const trace = await service.getFullTrace({
        lotId: mockLot.id,
        includeMovements: false,
      });
      expect(trace).toMatchObject({
        type: 'INGREDIENT',
        receivedAt: '2026-10-19T01:00:00.000Z',
        purchasedAt: null,
      });
    });
    it('traces actual ingredient and fuel lots with individual receipt dates and lifecycle', async () => {
      setupBatch();
      const trace = await service.getFullTrace({ lotId: 'batch-1' });
      expect(trace).toMatchObject({
        type: 'FINISHED_GOOD',
        imageSource: 'ACTUAL',
        imageUrl: '/uploads/actual.jpg',
        lifecycle: {
          inStockAt: '2026-10-18T01:00:00.000Z',
          readyAt: new Date('2026-10-20T02:30:00Z'),
        },
      });
      expect(trace.inputs).toHaveLength(2);
      expect(trace.inputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            lotId: 'food',
            receivedAt: '2026-10-19T01:00:00.000Z',
            purchasedAt: '2026-10-18',
            consumedQuantity: 5,
            usedQuantity: 4,
            wasteQuantity: 1,
          }),
          expect.objectContaining({
            lotId: 'fuel',
            receivedAt: '2026-10-18T01:00:00.000Z',
            product: expect.objectContaining({ productType: 'FUEL' }),
          }),
        ]),
      );
      expect(trace.timeline.map((row) => row.type)).toEqual([
        'IN_STOCK',
        'IN_STOCK',
        'MAKE',
        'READY',
        'COMPLETED',
        'EXPIRED_AT',
      ]);
    });
    it.each([null, '', '   '])(
      'falls back to the illustration for missing batch photo %p',
      async (image) => {
        setupBatch(image);
        expect(
          await service.getFullTrace({ lotId: 'batch-1' }),
        ).toMatchObject({
          imageSource: 'ILLUSTRATION',
          imageUrl: '/uploads/illustration.jpg',
        });
      },
    );
    it('returns null when neither photo exists and honors timeline suppression', async () => {
      setupBatch(null);
      mockRepositories.productRepository.findOne.mockResolvedValue({
        id: 'dish',
        productType: 'FINISHED_GOOD',
        imageUrl: null,
      });
      expect(
        await service.getFullTrace({
          lotId: 'batch-1',
          includeTimeline: false,
        }),
      ).toMatchObject({ imageUrl: null, imageSource: null, timeline: [] });
    });
    it('resolves a portion QR to its own batch, serial and immutable expiry', async () => {
      setupBatch();
      const unit = {
        id: 'unit-1',
        batchId: 'batch-1',
        serial: 1,
        expiresAt: new Date('2026-10-20T03:30:00Z'),
      };
      mockDataSource.query.mockResolvedValue([{ kind: 'UNIT', id: unit.id, batchId: unit.batchId }]);
      mockDataSource.getRepository = jest.fn(() => ({
        findOne: jest.fn(async () => unit),
      }));
      expect(
        await service.getFullTrace({ lotId: 'unit-1' }),
      ).toMatchObject({
        unit: { id: 'unit-1', serial: 1, batchId: 'batch-1' },
        lifecycle: { expiresAt: unit.expiresAt },
      });
    });
    it('returns 404 for unknown identities and rejects ambiguous identities', async () => {
      mockDataSource.query.mockResolvedValue([]);
      await expect(service.getFullTrace({ lotId: 'missing' })).rejects.toThrow('TRACE_ID_NOT_FOUND');
      mockDataSource.query.mockResolvedValue([{ kind: 'LOT' }, { kind: 'BATCH' }]);
      await expect(service.getFullTrace({ lotId: 'duplicate' })).rejects.toThrow('TRACE_ID_AMBIGUOUS');
    });
    it('reports confirmed handover without expiring the historical batch or changing its expiry', async () => {
      const batch = setupBatch();
      (batch.details as any).workflowTicketId = 'ticket';
      const deliveredAt = '2026-10-20T03:00:00Z';
      mockRepositories.kitchenOperationRepository.findOne.mockResolvedValue({ payload: { partialHandovers: [{
        deliveredAt, receivedBy: 'Cô Lan', items: [{ batchId: batch.id, quantity: 50 }],
      }] } });
      const result = await service.getFullTrace({ lotId: batch.id });
      expect(result).toMatchObject({ status: 'HANDED_OVER', handover: { deliveredAt },
        lifecycle: { expiresAt: batch.details.servingExpiresAt, handedOverAt: deliveredAt } });
      expect(mockRepositories.kitchenOperationRepository.findOne).toHaveBeenCalledWith({ where: { kind: 'task-flow', parentId: 'ticket' } });
    });
    it('resolves a material lot code to its UUID before fetching the trace', async () => {
      const code = 'LO-78e74975-7024-49d6-87c1-0b112e3e94ff';
      const id = '5a8d861e-301f-4de2-b13a-2991beb29864';
      mockDataSource.query.mockResolvedValue([{ kind: 'LOT', id }]);
      await service.getFullTrace({ lotId: ` ${code} `, includeMovements: false });
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('lot_code=$2'), [null, code]);
      expect(mockRepositories.stockLotRepository.findOne).toHaveBeenCalledWith({ where: { id } });
    });
    it('keeps UUID lookup available and binds the UUID without casting lot codes', async () => {
      const id = '5a8d861e-301f-4de2-b13a-2991beb29864';
      mockDataSource.query.mockResolvedValue([{ kind: 'LOT', id }]);
      await service.getFullTrace({ lotId: id, includeMovements: false });
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [id, id]);
    });
    it('resolves finished lot codes and reports duplicates instead of choosing a lot', async () => {
      setupBatch();
      mockDataSource.query.mockResolvedValue([{ kind: 'FINISHED_LOT', id: 'finished-lot', batchId: 'batch-1' }]);
      expect(await service.getFullTrace({ lotId: 'ME-12345678' })).toMatchObject({ production: { batchId: 'batch-1' } });
      mockDataSource.query.mockResolvedValue([{ kind: 'LOT', id: 'lot-a' }, { kind: 'LOT', id: 'lot-b' }]);
      await expect(service.getFullTrace({ lotId: 'LO-DUPLICATE' })).rejects.toThrow('TRACE_ID_AMBIGUOUS');
    });
    it('resolves a finished inventory lot through the same lotId parameter', async () => {
      setupBatch();
      mockDataSource.query.mockResolvedValue([{ kind: 'FINISHED_LOT', id: 'finished-lot', batchId: 'batch-1' }]);
      expect(await service.getFullTrace({ lotId: 'finished-lot' })).toMatchObject({ production: { batchId: 'batch-1' } });
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('UNION ALL'), [null, 'finished-lot']);
    });
  });

});
