import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { CreateProductRecipeDto } from './dto/product-recipe.dto';
import {
  LotMovementQueryDto,
  ProductLotsQueryDto,
  IngredientTraceQueryDto,
  TraceabilityReportQueryDto,
  ExpiringLotsQueryDto,
  ConsumedLotsQueryDto,
} from './dto/trace-query.dto';
import { FullTraceQueryDto } from './dto/full-trace-query.dto';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';
import { localDate } from '../stock/stock-movement.service';

export interface LotDetails {
  lot: StockLot;
  product: Product;
  currentQuantity: number;
  movements: StockMovement[];
  supplierTrace?: SupplierTraceResult | null;
}

export interface SupplierTraceResult {
  lotId: string;
  lotCode: string;
  supplierId?: string;
  supplierName?: string;
  importDate?: string;
  importCode?: string;
  importQuantity?: number;
}

export interface ProductTraceResult {
  productId: string;
  productName: string;
  lots: {
    lotId: string;
    lotCode: string;
    quantity: number;
    expiresAt: string | null;
    movements: any[];
  }[];
}

export interface IngredientTraceResult {
  finishedGoodId: string;
  finishedGoodName: string;
  batchId?: string;
  productionDate?: string;
  finishedLotId?: string;
  recipe?: ProductRecipe;
  ingredients: {
    productId: string;
    productName: string;
    requiredQuantity: number;
    actualConsumedQuantity?: number;
    lots?: {
      lotId: string;
      lotCode: string;
      consumedQuantity: number;
      importDate?: string;
      supplierName?: string;
    }[];
  }[];
}

@Injectable()
export class StockTraceService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(StockLot)
    private stockLotRepository: Repository<StockLot>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(StockReceiptDetail)
    private stockReceiptDetailRepository: Repository<StockReceiptDetail>,
    @InjectRepository(StockReceiptImport)
    private stockReceiptImportRepository: Repository<StockReceiptImport>,
    @InjectRepository(StockReceiptExport)
    private stockReceiptExportRepository: Repository<StockReceiptExport>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    @InjectRepository(ProductRecipe)
    private productRecipeRepository: Repository<ProductRecipe>,
    @InjectRepository(ProductRecipeItem)
    private productRecipeItemRepository: Repository<ProductRecipeItem>,
    @InjectRepository(KitchenProductionBatch)
    private kitchenBatchRepository: Repository<KitchenProductionBatch>,
    @InjectRepository(KitchenOperation)
    private kitchenOperationRepository: Repository<KitchenOperation>,
  ) {}

  // ============================================
  // LOT TRACEABILITY METHODS
  // ============================================

  async getLotDetails(lotId: string): Promise<LotDetails> {
    const lot = await this.stockLotRepository.findOne({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`Lot not found with ID ${lotId}`);
    }

    const product = await this.productRepository.findOne({
      where: { id: lot.productId },
    });

    const movements = await this.stockMovementRepository.find({
      where: { lotId },
      order: { createdAt: 'ASC' },
    });

    const supplierTrace = await this.traceToSupplier(lotId);

    return {
      lot,
      product: product!,
      currentQuantity: Number(lot.quantity),
      movements,
      supplierTrace,
    };
  }

  async getLotMovements(
    lotId: string,
    query: LotMovementQueryDto,
  ) {
    const pagination = normalizePagination(query.page, query.size);
    const qb = this.stockMovementRepository
      .createQueryBuilder('sm')
      .leftJoinAndSelect('sm.stock', 'stock')
      .leftJoinAndSelect('stock.branch', 'branch')
      .where('sm.lotId = :lotId', { lotId });

    if (query.fromDate) {
      qb.andWhere('sm.createdAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('sm.createdAt <= :toDate', {
        toDate: query.toDate,
      });
    }

    const [rows, total] = await qb
      .orderBy('sm.createdAt', 'ASC')
      .skip(pagination.skip)
      .take(pagination.size)
      .getManyAndCount();

    // Calculate cumulative quantity
    let cumulative = 0;
    const data = rows.map((row) => {
      cumulative += Number(row.quantity);
      return {
        ...row,
        cumulativeQuantity: cumulative,
      };
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async getLotStatusAt(lotId: string, asOfDate: Date) {
    const lot = await this.stockLotRepository.findOne({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`Lot not found with ID ${lotId}`);
    }

    // Sum movements up to the specified date
    const result = await this.stockMovementRepository
      .createQueryBuilder('sm')
      .select('SUM(sm.quantity)', 'totalQuantity')
      .where('sm.lotId = :lotId', { lotId })
      .andWhere('sm.createdAt <= :asOfDate', { asOfDate })
      .getRawOne();

    const quantityAtDate = Number(result?.totalQuantity || 0);
    const expiredAtDate = lot.expiresAt
      ? new Date(lot.expiresAt) <= asOfDate
      : false;

    return {
      lotId,
      lotCode: lot.lotCode,
      quantityAtDate,
      expiredAtDate,
      asOfDate: asOfDate.toISOString(),
    };
  }

  async getProductLots(productId: string, query: ProductLotsQueryDto) {
    const pagination = normalizePagination(query.page, query.size);
    const today = localDate();

    const qb = this.stockLotRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.stock', 'stock')
      .leftJoinAndSelect('stock.branch', 'branch')
      .where('sl.productId = :productId', { productId });

    if (query.branchId) {
      qb.andWhere('stock.branchId = :branchId', { branchId: query.branchId });
    }

    // Filter by status
    if (query.status === 'AVAILABLE') {
      qb.andWhere(
        '(sl.expires_at IS NULL OR sl.expires_at > :today)',
        { today },
      );
      qb.andWhere('sl.quantity > 0');
    } else if (query.status === 'EXPIRED') {
      qb.andWhere('sl.expires_at IS NOT NULL');
      qb.andWhere('sl.expires_at <= :today', { today });
    } else if (query.status === 'EXPIRING_SOON') {
      qb.andWhere('sl.expires_at IS NOT NULL');
      qb.andWhere('sl.expires_at > :today', { today });
      qb.andWhere(
        "sl.expires_at <= TO_CHAR(NOW() + INTERVAL '7 days', 'YYYY-MM-DD')",
      );
    }

    // Sort
    if (query.sortBy === 'FIFO') {
      qb.orderBy('sl.createdAt', 'ASC');
    } else if (query.sortBy === 'FEFO') {
      qb.orderBy('sl.expiresAt', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('sl.quantity', 'DESC');
    }

    const [rows, total] = await qb
      .skip(pagination.skip)
      .take(pagination.size)
      .getManyAndCount();

    return toPaginationResponse(rows, total, pagination.page, pagination.size);
  }

  // ============================================
  // SOURCE TRACEABILITY METHODS
  // ============================================

  async traceToSupplier(lotId: string): Promise<SupplierTraceResult | null> {
    // Find the import movement for this lot (quantity > 0)
    const importMovement = await this.stockMovementRepository.findOne({
      where: { lotId },
      order: { createdAt: 'ASC' },
    });

    if (!importMovement) {
      return null;
    }

    // Find the import receipt
    const importReceipt = await this.stockReceiptImportRepository.findOne({
      where: { id: importMovement.referenceId },
    });

    if (!importReceipt) {
      return null;
    }

    // Get supplier info
    let supplier: Supplier | null = null;
    if (importReceipt.fromType === 'SUPPLIER' && importReceipt.fromId) {
      supplier = await this.supplierRepository.findOne({
        where: { id: importReceipt.fromId },
      });
    }

    return {
      lotId,
      lotCode: '', // Will be filled from lot lookup
      supplierId: importReceipt.fromId || undefined,
      supplierName: supplier?.name,
      importDate: importReceipt.createdAt?.toISOString(),
      importCode: importReceipt.code,
      importQuantity: importMovement.quantity,
    };
  }

  async traceMovementChain(movementId: string, direction: 'FORWARD' | 'BACKWARD' | 'BOTH') {
    const movement = await this.stockMovementRepository.findOne({
      where: { id: movementId },
    });

    if (!movement) {
      throw new NotFoundException(`Movement not found with ID ${movementId}`);
    }

    const chain: any[] = [{ ...movement, direction: 'CENTER' }];

    if (direction === 'BACKWARD' || direction === 'BOTH') {
      // Find movements before this one with same lot/product
      const backwardMovements = await this.stockMovementRepository.find({
        where: {
          lotId: movement.lotId || undefined,
          productId: movement.productId,
        },
        order: { createdAt: 'ASC' },
      });

      const currentIndex = backwardMovements.findIndex((m) => m.id === movementId);
      if (currentIndex > 0) {
        chain.unshift(
          ...backwardMovements.slice(0, currentIndex).map((m) => ({
            ...m,
            direction: 'BEFORE',
          })),
        );
      }
    }

    if (direction === 'FORWARD' || direction === 'BOTH') {
      // Find movements after this one with same lot/product
      const forwardMovements = await this.stockMovementRepository.find({
        where: {
          lotId: movement.lotId || undefined,
          productId: movement.productId,
        },
        order: { createdAt: 'ASC' },
      });

      const currentIndex = forwardMovements.findIndex((m) => m.id === movementId);
      if (currentIndex < forwardMovements.length - 1) {
        chain.push(
          ...forwardMovements.slice(currentIndex + 1).map((m) => ({
            ...m,
            direction: 'AFTER',
          })),
        );
      }
    }

    return { movementId, chain };
  }

  async traceProduct(
    productId: string,
    options: {
      from?: string;
      to?: string;
      lotId?: string;
      branchId?: string;
    },
  ) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product not found with ID ${productId}`);
    }

    const qb = this.stockLotRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.stock', 'stock')
      .where('sl.productId = :productId', { productId });

    if (options.lotId) {
      qb.andWhere('sl.id = :lotId', { lotId: options.lotId });
    }
    if (options.branchId) {
      qb.andWhere('stock.branchId = :branchId', {
        branchId: options.branchId,
      });
    }

    const lots = await qb.getMany();

    // For each lot, get its movements
    const lotsWithMovements = await Promise.all(
      lots.map(async (lot) => {
        const movements = await this.stockMovementRepository.find({
          where: { lotId: lot.id },
          order: { createdAt: 'ASC' },
        });

        return {
          lotId: lot.id,
          lotCode: lot.lotCode,
          quantity: lot.quantity,
          expiresAt: lot.expiresAt,
          movements,
        };
      }),
    );

    return {
      productId,
      productName: product.name,
      lots: lotsWithMovements,
    };
  }

  async getInboundSummary(options: {
    branchId?: string;
    from?: string;
    to?: string;
    supplierId?: string;
  }) {
    const qb = this.stockReceiptImportRepository
      .createQueryBuilder('sri')
      .leftJoinAndSelect('sri.branch', 'branch')
      .leftJoinAndSelect('sri.details', 'details')
      .where('1=1');

    if (options.branchId) {
      qb.andWhere('sri.branchId = :branchId', { branchId: options.branchId });
    }
    if (options.from) {
      qb.andWhere('sri.createdAt >= :from', { from: options.from });
    }
    if (options.to) {
      qb.andWhere('sri.createdAt <= :to', { to: options.to });
    }
    if (options.supplierId) {
      qb.andWhere('sri.fromId = :supplierId', { supplierId: options.supplierId });
    }

    const imports = await qb.orderBy('sri.createdAt', 'DESC').getMany();

    // Group by supplier
    const summaryBySupplier = new Map<
      string,
      { supplierId: string; supplierName: string; totalQuantity: number; totalAmount: number; importCount: number }
    >();

    for (const importReceipt of imports) {
      const supplierId = importReceipt.fromId || 'UNKNOWN';
      const existing = summaryBySupplier.get(supplierId);
      const totalQuantity = importReceipt.details?.reduce(
        (sum, d) => sum + Number(d.quantity),
        0,
      ) || 0;

      if (existing) {
        existing.totalQuantity += totalQuantity;
        existing.totalAmount += Number(importReceipt.totalAmount || 0);
        existing.importCount += 1;
      } else {
        summaryBySupplier.set(supplierId, {
          supplierId,
          supplierName: '', // Will be filled from supplier lookup
          totalQuantity,
          totalAmount: Number(importReceipt.totalAmount || 0),
          importCount: 1,
        });
      }
    }

    return {
      totalImports: imports.length,
      totalBySupplier: Array.from(summaryBySupplier.values()),
    };
  }

  // ============================================
  // INGREDIENT TRACEABILITY METHODS
  // ============================================

  async getProductRecipe(productId: string, version?: number): Promise<ProductRecipe | null> {
    const qb = this.productRecipeRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.product', 'product')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('items.ingredientProduct', 'ingredientProduct')
      .where('pr.productId = :productId', { productId });

    if (version) {
      qb.andWhere('pr.version = :version', { version });
    } else {
      qb.andWhere('pr.status = :status', { status: 'ACTIVE' });
      qb.orderBy('pr.version', 'DESC');
    }

    return qb.getOne();
  }

  async getProductRecipes(productId: string, branchId?: string) {
    const qb = this.productRecipeRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.product', 'product')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('items.ingredientProduct', 'ingredientProduct')
      .where('pr.productId = :productId', { productId });

    if (branchId) {
      qb.andWhere('pr.branchId = :branchId', { branchId });
    }

    const [rows, total] = await qb.orderBy('pr.version', 'DESC').getManyAndCount();

    return toPaginationResponse(rows, total, 1, 100);
  }

  async createOrUpdateRecipe(
    dto: CreateProductRecipeDto,
    actorId?: string,
  ): Promise<ProductRecipe> {
    // Get the product to check branch
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product not found with ID ${dto.productId}`);
    }

    if (product.productType !== 'FINISHED_GOOD') {
      throw new NotFoundException('Recipe can only be created for FINISHED_GOOD products');
    }

    const branchId = dto.branchId || product.branchId || 'DEFAULT';

    // Get next version number
    const latestVersion = await this.productRecipeRepository
      .createQueryBuilder('pr')
      .where('pr.productId = :productId', { productId: dto.productId })
      .andWhere('pr.branchId = :branchId', { branchId })
      .orderBy('pr.version', 'DESC')
      .getOne();

    const version = dto.version || (latestVersion?.version || 0) + 1;

    const recipe = this.productRecipeRepository.create({
      branchId,
      productId: dto.productId,
      version,
      yieldQuantity: dto.yieldQuantity,
      yieldUnitId: dto.yieldUnitId,
      status: dto.status || 'DRAFT',
      description: dto.description,
      standardCost: dto.standardCost,
      createdBy: actorId,
    });

    const savedRecipe = await this.productRecipeRepository.save(recipe);

    // Create recipe items
    const items = dto.items.map((item) =>
      this.productRecipeItemRepository.create({
        recipeId: savedRecipe.id,
        ingredientProductId: item.ingredientProductId,
        quantity: item.quantity,
        unitId: item.unitId,
        requiredLotId: item.requiredLotId,
        wasteFactor: item.wasteFactor || 0,
        createdBy: actorId,
      }),
    );

    await this.productRecipeItemRepository.save(items);

    return this.getProductRecipe(dto.productId, version) as Promise<ProductRecipe>;
  }

  async activateRecipe(productId: string, version: number, actorId?: string) {
    // Deactivate all other versions
    await this.productRecipeRepository.update(
      { productId },
      { status: 'ARCHIVED' },
    );

    // Activate the specified version
    await this.productRecipeRepository.update(
      { productId, version },
      { status: 'ACTIVE', effectiveFrom: new Date(), updatedBy: actorId },
    );

    return this.getProductRecipe(productId);
  }

  async traceIngredients(
    productId: string,
    options: IngredientTraceQueryDto,
  ): Promise<IngredientTraceResult> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product not found with ID ${productId}`);
    }

    // Get the recipe
    const recipe = await this.getProductRecipe(productId);

    // Find the kitchen batch
    let batch: KitchenProductionBatch | null = null;
    let finishedLot: any = null;

    if (options.batchId) {
      batch = await this.kitchenBatchRepository.findOne({
        where: { id: options.batchId },
      });
    } else if (options.productionDate && options.branchId) {
      const batches = await this.kitchenBatchRepository
        .createQueryBuilder('b')
        .innerJoin('b.mealPlan', 'mp')
        .where('b.productId = :productId', { productId })
        .andWhere('mp.planDate = :planDate', { planDate: options.productionDate })
        .andWhere('mp.branchId = :branchId', { branchId: options.branchId })
        .getMany();

      batch = batches[0] || null;
    }

    if (options.finishedGoodLotId) {
      finishedLot = await this.kitchenOperationRepository.findOne({
        where: { id: options.finishedGoodLotId },
      });
    }

    const ingredients: IngredientTraceResult['ingredients'] = [];

    if (recipe?.items) {
      for (const item of recipe.items) {
        const ingredientProduct = await this.productRepository.findOne({
          where: { id: item.ingredientProductId },
        });

        // Find lots of this ingredient used in production
        const lots: any[] = [];

        if (batch) {
          // Find stock movements that consumed this ingredient for this batch
          const movements = await this.stockMovementRepository.find({
            where: { referenceId: batch.id },
          });

          for (const movement of movements) {
            if (movement.productId === item.ingredientProductId) {
              const lot = movement.lotId
                ? await this.stockLotRepository.findOne({
                    where: { id: movement.lotId },
                  })
                : null;

              lots.push({
                lotId: movement.lotId,
                lotCode: lot?.lotCode || 'N/A',
                consumedQuantity: Math.abs(Number(movement.quantity)),
                importDate: lot?.createdAt?.toISOString(),
              });
            }
          }
        }

        ingredients.push({
          productId: item.ingredientProductId,
          productName: ingredientProduct?.name || 'Unknown',
          requiredQuantity: Number(item.quantity),
          lots,
        });
      }
    }

    return {
      finishedGoodId: productId,
      finishedGoodName: product.name,
      batchId: batch?.id,
      productionDate: batch?.createdAt?.toISOString(),
      finishedLotId: finishedLot?.id,
      recipe: recipe || undefined,
      ingredients,
    };
  }

  async getConsumedLots(options: ConsumedLotsQueryDto) {
    if (!options.finishedGoodLotId && !options.productId) {
      throw new NotFoundException('Either finishedGoodLotId or productId is required');
    }

    // Find the batch
    const batch = await this.kitchenBatchRepository.findOne({
      where: options.productId
        ? { productId: options.productId }
        : { id: options.finishedGoodLotId! },
    });

    if (!batch) {
      return { consumedLots: [] };
    }

    // Get movements for this batch
    const movements = await this.stockMovementRepository.find({
      where: { referenceId: batch.id },
    });

    const consumedLots = await Promise.all(
      movements
        .filter((m) => Number(m.quantity) < 0 && m.lotId) // Only consumptions
        .map(async (m) => {
          const lot = await this.stockLotRepository.findOne({
            where: { id: m.lotId! },
          });

          return {
            lotId: m.lotId,
            lotCode: lot?.lotCode,
            productId: m.productId,
            consumedQuantity: Math.abs(Number(m.quantity)),
            consumedAt: m.createdAt?.toISOString(),
          };
        }),
    );

    return { consumedLots };
  }

  // ============================================
  // REPORTING METHODS
  // ============================================

  async generateTraceabilityReport(options: TraceabilityReportQueryDto) {
    const result: any = {
      generatedAt: new Date().toISOString(),
      filters: options,
    };

    if (options.lotId) {
      const lotDetails = await this.getLotDetails(options.lotId);
      result.lot = lotDetails;
    }

    if (options.productId) {
      const productTrace = await this.traceProduct(options.productId, {
        branchId: options.branchId,
        from: options.from,
        to: options.to,
        lotId: options.lotId,
      });
      result.product = productTrace;
    }

    return result;
  }

  async getExpiringLots(options: ExpiringLotsQueryDto) {
    const today = localDate();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + options.withinDays);
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const qb = this.stockLotRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.stock', 'stock')
      .leftJoinAndSelect('stock.branch', 'branch')
      .leftJoinAndSelect('sl.product', 'product')
      .where('sl.expiresAt IS NOT NULL')
      .andWhere('sl.expiresAt > :today', { today })
      .andWhere('sl.expiresAt <= :futureDate', { futureDate: futureDateStr })
      .andWhere('sl.quantity > 0');

    if (options.branchId) {
      qb.andWhere('stock.branchId = :branchId', { branchId: options.branchId });
    }

    if (options.productType) {
      qb.andWhere('product.productType = :productType', {
        productType: options.productType,
      });
    }

    const [rows, total] = await qb
      .orderBy('sl.expiresAt', 'ASC')
      .getManyAndCount();

    return toPaginationResponse(rows, total, 1, 100);
  }

  // ============================================
  // UNIFIED FULL-TRACE (one-shot endpoint)
  // ============================================

  async getFullTrace(query: FullTraceQueryDto) {
    const lot = await this.resolveLot(query);
    if (!lot) {
      throw new NotFoundException('Không tìm thấy lô với tham số đã cung cấp');
    }

    const [product, stock, movements] = await Promise.all([
      this.productRepository.findOne({ where: { id: lot.productId } }),
      this.stockRepository.findOne({ where: { id: lot.stockId } }),
      this.stockMovementRepository.find({
        where: { lotId: lot.id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const branch = stock?.branchId
      ? await this.branchRepository.findOne({ where: { id: stock.branchId } })
      : null;

    const origin = await this.resolveOrigin(lot, movements);
    const consumption =
      query.includeConsumption !== false
        ? await this.resolveConsumption(lot, movements)
        : null;
    const recipe =
      query.includeRecipe !== false && product?.productType === 'FINISHED_GOOD'
        ? await this.getProductRecipe(lot.productId)
        : null;

    const status = this.computeLotStatus(lot);
    const quantities = this.computeQuantities(movements);
    const movementsEnriched =
      query.includeMovements !== false
        ? await this.enrichMovements(movements)
        : [];
    const timeline =
      query.includeTimeline !== false
        ? this.buildTimeline(lot, origin, movementsEnriched, consumption)
        : [];

    return {
      generatedAt: new Date().toISOString(),
      lot: {
        id: lot.id,
        code: lot.lotCode,
        quantity: Number(lot.quantity),
        manufacturedAt: lot.manufacturedAt,
        expiresAt: lot.expiresAt,
        status,
        createdAt: lot.createdAt,
      },
      product: product
        ? {
            id: product.id,
            name: product.name,
            code: (product as any).code,
            productType: product.productType,
            unit: (product as any).unit,
            lotTrackingEnabled: (product as any).lotTrackingEnabled,
          }
        : null,
      location: stock
        ? {
            stockId: stock.id,
            stockName: stock.name,
            branchId: stock.branchId,
            branchName: branch?.name ?? null,
          }
        : null,
      quantities,
      origin,
      recipe: recipe
        ? {
            id: recipe.id,
            version: recipe.version,
            status: recipe.status,
            yieldQuantity: Number(recipe.yieldQuantity),
            standardCost: recipe.standardCost
              ? Number(recipe.standardCost)
              : null,
            items: (recipe.items ?? []).map((it) => ({
              ingredientProductId: it.ingredientProductId,
              ingredientName:
                (it as any).ingredientProduct?.name ?? 'Unknown',
              quantity: Number(it.quantity),
              unitId: it.unitId,
              wasteFactor: Number(it.wasteFactor ?? 0),
              requiredLotId: (it as any).requiredLotId ?? null,
            })),
          }
        : null,
      consumption,
      movements: movementsEnriched,
      timeline,
    };
  }

  private async resolveLot(query: FullTraceQueryDto): Promise<StockLot | null> {
    if (query.lotId) {
      return this.stockLotRepository.findOne({ where: { id: query.lotId } });
    }
    if (!query.lotCode) return null;

    const where: any = { lotCode: query.lotCode };
    if (query.stockId) where.stockId = query.stockId;
    if (query.productId) where.productId = query.productId;

    if (where.stockId) {
      return this.stockLotRepository.findOne({ where });
    }

    // Không có stockId: tìm theo branchId nếu có
    const qb = this.stockLotRepository
      .createQueryBuilder('sl')
      .where('sl.lotCode = :lotCode', { lotCode: query.lotCode });
    if (query.productId)
      qb.andWhere('sl.productId = :productId', { productId: query.productId });
    if (query.branchId) {
      qb.innerJoin(
        'stocks',
        'stock',
        'stock.id = sl.stockId AND stock.branch_id = :branchId',
        { branchId: query.branchId },
      );
    }
    return qb.orderBy('sl.createdAt', 'DESC').getOne();
  }

  private computeLotStatus(lot: StockLot): string {
    if (Number(lot.quantity) <= 0) return 'DEPLETED';
    if (lot.expiresAt) {
      const today = localDate();
      if (lot.expiresAt <= today) return 'EXPIRED';
      const soon = new Date();
      soon.setDate(soon.getDate() + 7);
      const soonStr = soon.toISOString().slice(0, 10);
      if (lot.expiresAt <= soonStr) return 'EXPIRING_SOON';
    }
    return 'AVAILABLE';
  }

  private computeQuantities(movements: StockMovement[]) {
    let inbound = 0;
    let outbound = 0;
    for (const m of movements) {
      const q = Number(m.quantity);
      if (q >= 0) inbound += q;
      else outbound += Math.abs(q);
    }
    return {
      inbound,
      outbound,
      balance: inbound - outbound,
      movementCount: movements.length,
    };
  }

  private async resolveOrigin(lot: StockLot, movements: StockMovement[]) {
    const firstInbound = movements.find((m) => Number(m.quantity) > 0);
    if (!firstInbound) {
      return {
        type: 'UNKNOWN',
        lotCode: lot.lotCode,
        reason: 'Lô chưa có giao dịch nhập',
      };
    }

    // Thử tìm trong receipt import (supplier/other)
    const importReceipt = await this.stockReceiptImportRepository.findOne({
      where: { id: firstInbound.referenceId },
    });
    if (importReceipt) {
      let supplier: Supplier | null = null;
      if (importReceipt.fromType === 'SUPPLIER' && importReceipt.fromId) {
        supplier = await this.supplierRepository.findOne({
          where: { id: importReceipt.fromId },
        });
      }
      return {
        type: importReceipt.fromType || 'IMPORT',
        receiptId: importReceipt.id,
        receiptCode: importReceipt.code,
        receivedAt: importReceipt.createdAt?.toISOString() ?? null,
        quantity: Number(firstInbound.quantity),
        supplier: supplier
          ? {
              id: supplier.id,
              code: supplier.code,
              name: supplier.name,
              phone: supplier.phone,
              address: supplier.address,
              taxCode: supplier.taxCode,
            }
          : null,
        note: importReceipt.note ?? null,
      };
    }

    // Thử tìm trong production batch (sản xuất nội bộ)
    const batch = await this.kitchenBatchRepository.findOne({
      where: { id: firstInbound.referenceId },
    });
    if (batch) {
      return {
        type: 'PRODUCTION',
        batchId: batch.id,
        producedAt: batch.createdAt?.toISOString() ?? null,
        quantity: Number(firstInbound.quantity),
      };
    }

    return {
      type: 'UNKNOWN',
      referenceId: firstInbound.referenceId,
      reason: 'Không map được reference về chứng từ gốc',
      quantity: Number(firstInbound.quantity),
    };
  }

  private async resolveConsumption(
    _lot: StockLot,
    movements: StockMovement[],
  ) {
    const outbound = movements.filter((m) => Number(m.quantity) < 0);
    if (!outbound.length) return { consumedBy: [] };

    const batchIds = Array.from(new Set(outbound.map((m) => m.referenceId)));
    const batches = batchIds.length
      ? await this.kitchenBatchRepository
          .createQueryBuilder('b')
          .where('b.id IN (:...ids)', { ids: batchIds })
          .getMany()
      : [];
    const batchMap = new Map(batches.map((b) => [b.id, b]));

    // Lấy tên product thành phẩm từ batch
    const prodIds = Array.from(
      new Set(batches.map((b: any) => b.productId).filter(Boolean)),
    );
    const prods = prodIds.length
      ? await this.productRepository
          .createQueryBuilder('p')
          .where('p.id IN (:...ids)', { ids: prodIds })
          .getMany()
      : [];
    const prodMap = new Map(prods.map((p) => [p.id, p]));

    return {
      consumedBy: outbound.map((m) => {
        const batch = batchMap.get(m.referenceId) as any;
        const finished = batch ? prodMap.get(batch.productId) : null;
        return {
          movementId: m.id,
          referenceId: m.referenceId,
          referenceType: batch ? 'PRODUCTION_BATCH' : 'OTHER',
          consumedQuantity: Math.abs(Number(m.quantity)),
          consumedAt: m.createdAt?.toISOString() ?? null,
          finishedGood: finished
            ? { id: finished.id, name: finished.name }
            : null,
        };
      }),
    };
  }

  private async enrichMovements(movements: StockMovement[]) {
    if (!movements.length) return [];
    const stockIds = Array.from(new Set(movements.map((m) => m.stockId)));
    const stocks = await this.stockRepository
      .createQueryBuilder('s')
      .where('s.id IN (:...ids)', { ids: stockIds })
      .getMany();
    const stockMap = new Map<string, Stock>(stocks.map((s) => [s.id, s]));

    let cumulative = 0;
    return movements.map((m) => {
      const q = Number(m.quantity);
      cumulative += q;
      const stock = stockMap.get(m.stockId);
      return {
        id: m.id,
        quantity: q,
        direction: q >= 0 ? 'IN' : 'OUT',
        cumulativeQuantity: cumulative,
        referenceId: m.referenceId,
        stockId: m.stockId,
        stockName: stock?.name ?? null,
        branchId: stock?.branchId ?? null,
        at: m.createdAt?.toISOString() ?? null,
      };
    });
  }

  private buildTimeline(
    lot: StockLot,
    origin: any,
    movements: any[],
    consumption: any,
  ) {
    const events: { at: string | null; type: string; detail: any }[] = [];

    if (origin?.receivedAt || origin?.producedAt) {
      events.push({
        at: origin.receivedAt ?? origin.producedAt ?? null,
        type: origin.type === 'PRODUCTION' ? 'PRODUCED' : 'RECEIVED',
        detail: origin,
      });
    }

    const consumedMovementIds = new Set<string>(
      (consumption?.consumedBy ?? [])
        .filter((c: any) => c.finishedGood)
        .map((c: any) => c.movementId),
    );

    for (const m of movements) {
      events.push({
        at: m.at,
        type:
          m.direction === 'IN'
            ? 'INBOUND'
            : consumedMovementIds.has(m.id)
              ? 'CONSUMED_FOR_PRODUCTION'
              : 'OUTBOUND',
        detail: m,
      });
    }

    if (lot.expiresAt) {
      events.push({
        at: `${lot.expiresAt}T00:00:00.000Z`,
        type: 'EXPIRY_DATE',
        detail: { expiresAt: lot.expiresAt },
      });
    }

    return events.sort((a, b) => {
      if (!a.at) return 1;
      if (!b.at) return -1;
      return a.at.localeCompare(b.at);
    });
  }
}
