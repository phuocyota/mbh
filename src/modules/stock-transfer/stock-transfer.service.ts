import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product, StockReceiptTransfer, StockReceiptDetail, Stock, StockItem } from '../../entities';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';

@Injectable()
export class StockTransferService {
  constructor(
    @InjectRepository(StockReceiptTransfer)
    private transferRepository: Repository<StockReceiptTransfer>,
    @InjectRepository(StockReceiptDetail)
    private detailRepository: Repository<StockReceiptDetail>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
    private dataSource: DataSource,
  ) {}

  async findAll(filters: { status?: string; fromBranchId?: string; toBranchId?: string } = {}) {
    const query = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.fromBranch', 'fromBranch')
      .leftJoinAndSelect('transfer.toBranch', 'toBranch')
      .leftJoinAndSelect('transfer.details', 'details')
      .leftJoinAndSelect('details.product', 'product');

    if (filters.status) {
      query.andWhere('transfer.status = :status', { status: filters.status });
    }
    if (filters.fromBranchId) {
      query.andWhere('transfer.fromBranchId = :fromBranchId', { fromBranchId: filters.fromBranchId });
    }
    if (filters.toBranchId) {
      query.andWhere('transfer.toBranchId = :toBranchId', { toBranchId: filters.toBranchId });
    }

    return query.orderBy('transfer.createdAt', 'DESC').getMany();
  }

  async findOne(id: string) {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: ['fromBranch', 'toBranch', 'details', 'details.product'],
    });

    if (!transfer) {
      throw new NotFoundException(`StockTransfer not found with ID ${id}`);
    }

    return transfer;
  }

  private async getOrCreateBranchStock(
    stockRepo: Repository<Stock>,
    branchId: string,
  ): Promise<Stock> {
    let stock = await stockRepo.findOne({ where: { branchId } });
    if (!stock) {
      stock = await stockRepo.save(
        stockRepo.create({
          name: `Kho Chi Nhánh`,
          branchId,
        }),
      );
    }
    return stock;
  }

  private async updateStockItemQuantity(
    stockItemRepo: Repository<StockItem>,
    stockId: string,
    productId: string,
    quantityChange: number,
  ) {
    let stockItem = await stockItemRepo.findOne({
      where: { stockId, productId },
    });

    if (!stockItem) {
      stockItem = stockItemRepo.create({
        stockId,
        productId,
        quantity: 0,
      });
    }

    stockItem.quantity = Number(stockItem.quantity) + Number(quantityChange);
    await stockItemRepo.save(stockItem);
  }

  async create(dto: CreateStockTransferDto) {
    return this.dataSource.transaction(async (trx) => {
      const transferRepo = trx.getRepository(StockReceiptTransfer);
      const detailRepo = trx.getRepository(StockReceiptDetail);
      const productRepo = trx.getRepository(Product);
      const stockRepo = trx.getRepository(Stock);

      const fromStock = await this.getOrCreateBranchStock(stockRepo, dto.fromBranchId);
      const toStock = await this.getOrCreateBranchStock(stockRepo, dto.toBranchId);

      let totalAmount = 0;
      const detailsToSave: StockReceiptDetail[] = [];

      for (const dtoItem of dto.items) {
        const product = await productRepo.findOne({ where: { id: dtoItem.productId } });
        if (!product) {
          throw new NotFoundException(`Product not found with ID ${dtoItem.productId}`);
        }

        const unitCost = Number(product.costPrice || product.price || 0);
        const itemTotal = Number(dtoItem.quantity) * unitCost;
        totalAmount += itemTotal;

        const detail = detailRepo.create({
          productId: product.id,
          quantity: Number(dtoItem.quantity),
          receiptType: 'TRANSFER',
          fromId: fromStock.id,
          toId: toStock.id,
          fromType: 'STOCK',
          toType: 'STOCK',
        });

        detailsToSave.push(detail);
      }

      const code = `CK${Date.now()}`;
      const transfer = transferRepo.create({
        code,
        transferId: '00000000-0000-0000-0000-000000000000', // unused but NOT NULL compatibility placeholder
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        status: 'DRAFT',
        totalAmount,
        note: dto.note,
      });

      const savedTransfer = await transferRepo.save(transfer);

      for (const detail of detailsToSave) {
        detail.transferId = savedTransfer.id;
        await detailRepo.save(detail);
      }

      return this.findOne(savedTransfer.id);
    });
  }

  async complete(id: string) {
    return this.dataSource.transaction(async (trx) => {
      const transferRepo = trx.getRepository(StockReceiptTransfer);
      const stockRepo = trx.getRepository(Stock);
      const stockItemRepo = trx.getRepository(StockItem);

      const transfer = await transferRepo.findOne({
        where: { id },
        relations: ['details'],
      });

      if (!transfer) {
        throw new NotFoundException(`StockTransfer not found with ID ${id}`);
      }

      if (transfer.status !== 'DRAFT') {
        throw new BadRequestException(`StockTransfer is already in ${transfer.status} status`);
      }

      const fromStock = await this.getOrCreateBranchStock(stockRepo, transfer.fromBranchId);
      const toStock = await this.getOrCreateBranchStock(stockRepo, transfer.toBranchId);

      for (const detail of transfer.details) {
        if (detail.productId) {
          // Subtract from source stock
          await this.updateStockItemQuantity(stockItemRepo, fromStock.id, detail.productId, -Number(detail.quantity));
          // Add to destination stock
          await this.updateStockItemQuantity(stockItemRepo, toStock.id, detail.productId, Number(detail.quantity));
        }
      }

      transfer.status = 'COMPLETED';
      transfer.receivedAt = new Date();
      await transferRepo.save(transfer);

      return this.findOne(id);
    });
  }
}
