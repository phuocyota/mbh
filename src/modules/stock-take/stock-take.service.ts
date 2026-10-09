import { StockMovementService } from '../stock/stock-movement.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Product,
  StockTake,
  StockTakeItem,
  Stock,
  StockItem,
} from '../../entities';
import { CreateStockTakeDto } from './dto/create-stock-take.dto';
import { DEFAULT_BRANCH_ID } from '../../common/constant/default-branch.constant';
import { StockService } from '../stock/stock.service';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

@Injectable()
export class StockTakeService {
  constructor(
    @InjectRepository(StockTake)
    private stockTakeRepository: Repository<StockTake>,
    @InjectRepository(StockTakeItem)
    private stockTakeItemRepository: Repository<StockTakeItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
    private dataSource: DataSource,
    private stockService: StockService,
    private movements: StockMovementService,
  ) {}

  async findAll(
    filters: {
      status?: string;
      branchId?: string;
      page?: number | string;
      size?: number | string;
    } = {},
  ) {
    const pagination = normalizePagination(filters.page, filters.size);
    const query = this.stockTakeRepository
      .createQueryBuilder('stockTake')
      .leftJoinAndSelect('stockTake.branch', 'branch')
      .leftJoinAndSelect('stockTake.items', 'items')
      .leftJoinAndSelect('items.product', 'product');

    if (filters.status) {
      query.andWhere('stockTake.status = :status', { status: filters.status });
    }
    if (filters.branchId) {
      query.andWhere('stockTake.branchId = :branchId', {
        branchId: filters.branchId,
      });
    }

    const orderedQuery = query.orderBy('stockTake.createdAt', 'DESC');
    const [idRows, total] = await Promise.all([
      orderedQuery
        .clone()
        .select('stockTake.id', 'id')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      orderedQuery.clone().getCount(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const stockTakes = await this.stockTakeRepository.find({
      where: { id: In(ids) },
      relations: ['branch', 'items', 'items.product'],
    });

    const stockTakeById = new Map(
      stockTakes.map((stockTake) => [stockTake.id, stockTake]),
    );
    const data = ids
      .map((id) => stockTakeById.get(id))
      .filter((stockTake): stockTake is StockTake => !!stockTake);

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findOne(id: string) {
    const stockTake = await this.stockTakeRepository.findOne({
      where: { id },
      relations: ['branch', 'items', 'items.product'],
    });

    if (!stockTake) {
      throw new NotFoundException(`StockTake not found with ID ${id}`);
    }

    return stockTake;
  }

  async createDraft(dto: CreateStockTakeDto) {
    if (
      !dto.items?.length ||
      new Set(dto.items.map((item) => item.productId)).size !== dto.items.length
    )
      throw new BadRequestException('INVALID_STOCK_TAKE_ITEMS');
    return this.dataSource.transaction(async (trx) => {
      const stockTakeRepo = trx.getRepository(StockTake);
      const stockTakeItemRepo = trx.getRepository(StockTakeItem);
      const productRepo = trx.getRepository(Product);
      const stockItemRepo = trx.getRepository(StockItem);

      const branchId = dto.branchId || DEFAULT_BRANCH_ID;
      await this.movements.lockProducts(
        trx,
        dto.items.map((item) => item.productId),
      );
      const branchStock = await this.stockService.getOrCreateBranchStock(
        branchId,
        trx,
      );
      const code = `KK${Date.now()}`;

      let totalDifferenceAmount = 0;
      let increaseQuantity = 0;
      let decreaseQuantity = 0;

      const itemsToSave: StockTakeItem[] = [];

      for (const dtoItem of dto.items) {
        const product = await productRepo.findOne({
          where: { id: dtoItem.productId },
        });
        if (!product) {
          throw new NotFoundException(
            `Product not found with ID ${dtoItem.productId}`,
          );
        }

        // Get system quantity from StockItem
        const stockItem = await stockItemRepo.findOne({
          where: { stockId: branchStock.id, productId: product.id },
        });
        if (product.branchId && product.branchId !== branchId && !stockItem)
          throw new BadRequestException('CROSS_BRANCH_PRODUCT');
        const systemQuantity = stockItem ? Number(stockItem.quantity) : 0;
        const actualQuantity = Number(dtoItem.actualQuantity);
        const differenceQuantity = actualQuantity - systemQuantity;
        const unitCost = Number(product.costPrice || product.price || 0);
        const differenceAmount = differenceQuantity * unitCost;

        if (differenceQuantity > 0) {
          increaseQuantity += differenceQuantity;
        } else if (differenceQuantity < 0) {
          decreaseQuantity += Math.abs(differenceQuantity);
        }
        totalDifferenceAmount += differenceAmount;

        const stockTakeItem = stockTakeItemRepo.create({
          createdBy: dto.actorId,
          productId: product.id,
          lotCounts: dtoItem.lotCounts || null,
          systemQuantity,
          actualQuantity,
          differenceQuantity,
          unitCost,
          differenceAmount,
        });

        itemsToSave.push(stockTakeItem);
      }

      const stockTake = stockTakeRepo.create({
        createdBy: dto.actorId,
        branchId,
        code,
        status: 'DRAFT',
        totalDifferenceAmount,
        increaseQuantity,
        decreaseQuantity,
        note: dto.note,
      });

      const savedStockTake = await stockTakeRepo.save(stockTake);

      for (const item of itemsToSave) {
        item.stockTakeId = savedStockTake.id;
        await stockTakeItemRepo.save(item);
      }

      return stockTakeRepo.findOneOrFail({
        where: { id: savedStockTake.id },
        relations: ['items', 'items.product'],
      });
    });
  }

  async complete(id: string, actorId?: string) {
    return this.dataSource.transaction(async (trx) => {
      const stockTakeRepo = trx.getRepository(StockTake);
      await stockTakeRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      const stockTake = await stockTakeRepo.findOne({
        where: { id },
        relations: ['items'],
      });

      if (!stockTake) {
        throw new NotFoundException(`StockTake not found with ID ${id}`);
      }

      if (stockTake.status !== 'DRAFT') {
        throw new BadRequestException(
          `StockTake is already in ${stockTake.status} status`,
        );
      }

      await this.movements.lockProducts(
        trx,
        stockTake.items.map((item) => item.productId),
      );
      const branchStock = await this.stockService.getOrCreateBranchStock(
        stockTake.branchId,
        trx,
      );

      for (const item of stockTake.items) {
        await this.movements.recount(
          trx,
          branchStock.id,
          item.productId,
          Number(item.systemQuantity),
          Number(item.actualQuantity),
          item.lotCounts,
          stockTake.id,
          actorId,
        );
      }

      stockTake.status = 'COMPLETED';
      stockTake.updatedBy = actorId;
      stockTake.countedAt = new Date();
      await stockTakeRepo.save(stockTake);

      return stockTakeRepo.findOneOrFail({
        where: { id },
        relations: ['items', 'items.product'],
      });
    });
  }
}
