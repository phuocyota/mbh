import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Product,
  StockTake,
  StockTakeItem,
  StockTransaction,
} from '../../entities';
import { DEFAULT_BRANCH_ID } from '../../common/constant/default-branch.constant';
import {
  CreateStockTakeDto,
  StockTakeItemInputDto,
} from './dto/stock-take.dto';

const STOCK_TAKE_STATUS = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
} as const;

@Injectable()
export class StockTakeService {
  constructor(
    @InjectRepository(StockTake)
    private readonly stockTakeRepository: Repository<StockTake>,
    @InjectRepository(StockTakeItem)
    private readonly stockTakeItemRepository: Repository<StockTakeItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: { status?: string; branchId?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status.toUpperCase();
    if (query.branchId) where.branchId = query.branchId;

    return this.stockTakeRepository.find({
      where,
      relations: ['branch', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const stockTake = await this.stockTakeRepository.findOne({
      where: { id },
      relations: ['branch', 'items', 'items.product'],
    });

    if (!stockTake) {
      throw new NotFoundException(`Stock take not found: ${id}`);
    }

    return stockTake;
  }

  async createDraft(dto: CreateStockTakeDto) {
    return this.dataSource.transaction(async (trx) => {
      const stockTakeRepo = trx.getRepository(StockTake);
      const stockTake = await stockTakeRepo.save(
        stockTakeRepo.create({
          branchId: dto.branchId || DEFAULT_BRANCH_ID,
          code: `KK${Date.now()}`,
          status: STOCK_TAKE_STATUS.DRAFT,
          countedAt: dto.countedAt ? new Date(dto.countedAt) : new Date(),
          note: dto.note,
        }),
      );

      if (dto.items?.length) {
        await this.replaceItemsInTransaction(trx, stockTake, dto.items);
      }

      return this.findOneWithManager(trx, stockTake.id);
    });
  }

  async replaceItems(id: string, items: StockTakeItemInputDto[]) {
    return this.dataSource.transaction(async (trx) => {
      const stockTake = await this.findOneWithManager(trx, id);
      if (stockTake.status !== STOCK_TAKE_STATUS.DRAFT) {
        throw new BadRequestException('Only draft stock takes can be edited');
      }

      await this.replaceItemsInTransaction(trx, stockTake, items);
      await this.recalculateHeader(trx, stockTake.id);

      return this.findOneWithManager(trx, id);
    });
  }

  async complete(id: string) {
    return this.dataSource.transaction(async (trx) => {
      const stockTake = await this.findOneWithManager(trx, id);
      if (stockTake.status !== STOCK_TAKE_STATUS.DRAFT) {
        throw new BadRequestException('Only draft stock takes can be completed');
      }
      if (!stockTake.items?.length) {
        throw new BadRequestException('Stock take items are required');
      }

      const productRepo = trx.getRepository(Product);
      const stockTransactionRepo = trx.getRepository(StockTransaction);

      for (const item of stockTake.items) {
        const product = await productRepo.findOne({
          where: { id: item.productId },
        });
        if (!product) {
          throw new NotFoundException(`Product not found: ${item.productId}`);
        }

        const difference = Number(item.actualQuantity) - Number(product.quantity || 0);
        product.quantity = Number(item.actualQuantity);
        await productRepo.save(product);

        if (difference !== 0) {
          await stockTransactionRepo.save(
            stockTransactionRepo.create({
              branchId: stockTake.branchId,
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: difference,
              refType: 'STOCK_TAKE',
              refId: stockTake.id,
              note: stockTake.note,
            }),
          );
        }
      }

      stockTake.status = STOCK_TAKE_STATUS.COMPLETED;
      stockTake.countedAt = stockTake.countedAt || new Date();
      await trx.getRepository(StockTake).save(stockTake);
      await this.recalculateHeader(trx, stockTake.id);

      return this.findOneWithManager(trx, id);
    });
  }

  private async replaceItemsInTransaction(
    trx: EntityManager,
    stockTake: StockTake,
    items: StockTakeItemInputDto[],
  ) {
    const itemRepo = trx.getRepository(StockTakeItem);
    const productRepo = trx.getRepository(Product);
    await itemRepo.delete({ stockTakeId: stockTake.id });

    for (const dtoItem of items) {
      const product = await productRepo.findOne({
        where: { id: dtoItem.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product not found: ${dtoItem.productId}`);
      }

      const systemQuantity = Number(product.quantity || 0);
      const actualQuantity = Number(dtoItem.actualQuantity || 0);
      const differenceQuantity = actualQuantity - systemQuantity;
      const unitCost = Number(product.costPrice || 0);

      await itemRepo.save(
        itemRepo.create({
          stockTakeId: stockTake.id,
          productId: dtoItem.productId,
          systemQuantity,
          actualQuantity,
          differenceQuantity,
          unitCost,
          differenceAmount: differenceQuantity * unitCost,
          note: dtoItem.note,
        }),
      );
    }
  }

  private async recalculateHeader(trx: EntityManager, stockTakeId: string) {
    const itemRepo = trx.getRepository(StockTakeItem);
    const stockTakeRepo = trx.getRepository(StockTake);
    const items = await itemRepo.find({ where: { stockTakeId } });

    const increaseQuantity = items.reduce((sum, item) => {
      const diff = Number(item.differenceQuantity || 0);
      return diff > 0 ? sum + diff : sum;
    }, 0);
    const decreaseQuantity = items.reduce((sum, item) => {
      const diff = Number(item.differenceQuantity || 0);
      return diff < 0 ? sum + Math.abs(diff) : sum;
    }, 0);
    const totalDifferenceAmount = items.reduce(
      (sum, item) => sum + Number(item.differenceAmount || 0),
      0,
    );

    await stockTakeRepo.update(stockTakeId, {
      increaseQuantity,
      decreaseQuantity,
      totalDifferenceAmount,
    });
  }

  private async findOneWithManager(trx: EntityManager, id: string) {
    const stockTake = await trx.getRepository(StockTake).findOne({
      where: { id },
      relations: ['branch', 'items', 'items.product'],
    });

    if (!stockTake) {
      throw new NotFoundException(`Stock take not found: ${id}`);
    }

    return stockTake;
  }
}
