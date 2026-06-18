import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Product,
  StockTransaction,
  StockTransfer,
  StockTransferItem,
} from '../../entities';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';

const STOCK_TRANSFER_STATUS = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
} as const;

@Injectable()
export class StockTransferService {
  constructor(
    @InjectRepository(StockTransfer)
    private readonly stockTransferRepository: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem)
    private readonly stockTransferItemRepository: Repository<StockTransferItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: {
    status?: string;
    fromBranchId?: string;
    toBranchId?: string;
  }) {
    const where: any = {};
    if (query.status) where.status = query.status.toUpperCase();
    if (query.fromBranchId) where.fromBranchId = query.fromBranchId;
    if (query.toBranchId) where.toBranchId = query.toBranchId;

    return this.stockTransferRepository.find({
      where,
      relations: ['fromBranch', 'toBranch', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const transfer = await this.stockTransferRepository.findOne({
      where: { id },
      relations: ['fromBranch', 'toBranch', 'items', 'items.product'],
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer not found: ${id}`);
    }

    return transfer;
  }

  async create(dto: CreateStockTransferDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('fromBranchId and toBranchId must be different');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Stock transfer items are required');
    }

    return this.dataSource.transaction(async (trx) => {
      const transferRepo = trx.getRepository(StockTransfer);
      const itemRepo = trx.getRepository(StockTransferItem);
      const productRepo = trx.getRepository(Product);

      const transfer = await transferRepo.save(
        transferRepo.create({
          code: `CK${Date.now()}`,
          fromBranchId: dto.fromBranchId,
          toBranchId: dto.toBranchId,
          status: STOCK_TRANSFER_STATUS.DRAFT,
          transferredAt: dto.transferredAt ? new Date(dto.transferredAt) : new Date(),
          note: dto.note,
        }),
      );

      let totalAmount = 0;
      for (const dtoItem of dto.items) {
        const product = await productRepo.findOne({
          where: { id: dtoItem.productId },
        });
        if (!product) {
          throw new NotFoundException(`Product not found: ${dtoItem.productId}`);
        }

        const quantity = Number(dtoItem.quantity);
        const unitCost = Number(product.costPrice || 0);
        const amount = quantity * unitCost;
        totalAmount += amount;

        await itemRepo.save(
          itemRepo.create({
            transferId: transfer.id,
            productId: dtoItem.productId,
            quantity,
            unitCost,
            totalAmount: amount,
            note: dtoItem.note,
          }),
        );
      }

      transfer.totalAmount = totalAmount;
      await transferRepo.save(transfer);

      return this.findOneWithManager(trx, transfer.id);
    });
  }

  async complete(id: string) {
    return this.dataSource.transaction(async (trx) => {
      const transfer = await this.findOneWithManager(trx, id);
      if (transfer.status !== STOCK_TRANSFER_STATUS.DRAFT) {
        throw new BadRequestException('Only draft stock transfers can be completed');
      }
      if (!transfer.items?.length) {
        throw new BadRequestException('Stock transfer items are required');
      }

      const stockTransactionRepo = trx.getRepository(StockTransaction);

      for (const item of transfer.items) {
        await stockTransactionRepo.save([
          stockTransactionRepo.create({
            branchId: transfer.fromBranchId,
            productId: item.productId,
            type: 'TRANSFER_OUT',
            quantity: Number(item.quantity),
            refType: 'STOCK_TRANSFER',
            refId: transfer.id,
            note: transfer.note,
          }),
          stockTransactionRepo.create({
            branchId: transfer.toBranchId,
            productId: item.productId,
            type: 'TRANSFER_IN',
            quantity: Number(item.quantity),
            refType: 'STOCK_TRANSFER',
            refId: transfer.id,
            note: transfer.note,
          }),
        ]);
      }

      transfer.status = STOCK_TRANSFER_STATUS.COMPLETED;
      transfer.transferredAt = transfer.transferredAt || new Date();
      await trx.getRepository(StockTransfer).save(transfer);

      return this.findOneWithManager(trx, id);
    });
  }

  private async findOneWithManager(trx: EntityManager, id: string) {
    const transfer = await trx.getRepository(StockTransfer).findOne({
      where: { id },
      relations: ['fromBranch', 'toBranch', 'items', 'items.product'],
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer not found: ${id}`);
    }

    return transfer;
  }
}
