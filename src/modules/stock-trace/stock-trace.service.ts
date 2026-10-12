import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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
  MeasurementUnit,
} from '../../entities';
import {
  CreateProductRecipeDto,
  UpdateProductRecipeDto,
} from './dto/product-recipe.dto';
import {
  LotMovementQueryDto,
  ProductLotsQueryDto,
  IngredientTraceQueryDto,
  TraceabilityReportQueryDto,
  ExpiringLotsQueryDto,
  ConsumedLotsQueryDto,
} from './dto/trace-query.dto';
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
}
