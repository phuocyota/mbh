import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Product,
  StockReceiptTransfer,
  StockReceiptDetail,
  Stock,
  StockItem,
} from '../../entities';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import { StockService } from '../stock/stock.service';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

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
    private stockVoucherService: StockVoucherService,
    private stockService: StockService,
  ) {}

  async findAll(
    filters: {
      status?: string;
      branchId?: string;
      fromBranchId?: string;
      toBranchId?: string;
      page?: number | string;
      size?: number | string;
    } = {},
  ) {
    const pagination = normalizePagination(filters.page, filters.size);
    const query = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.fromBranch', 'fromBranch')
      .leftJoinAndSelect('transfer.toBranch', 'toBranch')
      .leftJoinAndSelect('transfer.details', 'details')
      .leftJoinAndSelect('details.product', 'product');

    if (filters.status) {
      query.andWhere('transfer.status = :status', { status: filters.status });
    }
    if (filters.branchId) {
      query.andWhere(
        '(transfer.fromBranchId = :branchId OR transfer.toBranchId = :branchId)',
        { branchId: filters.branchId },
      );
    }
    if (filters.fromBranchId) {
      query.andWhere('transfer.fromBranchId = :fromBranchId', {
        fromBranchId: filters.fromBranchId,
      });
    }
    if (filters.toBranchId) {
      query.andWhere('transfer.toBranchId = :toBranchId', {
        toBranchId: filters.toBranchId,
      });
    }

    const orderedQuery = query.orderBy('transfer.createdAt', 'DESC');
    const [idRows, total] = await Promise.all([
      orderedQuery
        .clone()
        .select('transfer.id', 'id')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      orderedQuery.clone().getCount(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const transfers = await this.transferRepository.find({
      where: { id: In(ids) },
      relations: ['fromBranch', 'toBranch', 'details', 'details.product'],
    });

    const transferById = new Map(
      transfers.map((transfer) => [transfer.id, transfer]),
    );
    const data = ids
      .map((id) => transferById.get(id))
      .filter((transfer): transfer is StockReceiptTransfer => !!transfer);

    return toPaginationResponse(data, total, pagination.page, pagination.size);
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

      const fromStock = await this.stockService.getOrCreateBranchStock(
        dto.fromBranchId,
        trx,
      );
      const toStock = await this.stockService.getOrCreateBranchStock(
        dto.toBranchId,
        trx,
      );

      let totalAmount = 0;
      const detailsToSave: StockReceiptDetail[] = [];
      const voucherItems: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
      }> = [];

      for (const dtoItem of dto.items) {
        const product = await productRepo.findOne({
          where: { id: dtoItem.productId },
        });
        if (!product) {
          throw new NotFoundException(
            `Product not found with ID ${dtoItem.productId}`,
          );
        }

        const unitCost = Number(product.costPrice || product.price || 0);
        const quantity = Number(dtoItem.quantity);
        const itemTotal = quantity * unitCost;
        totalAmount += itemTotal;
        voucherItems.push({
          productId: product.id,
          quantity,
          unitPrice: unitCost,
        });

        const detail = detailRepo.create({
          productId: product.id,
          quantity,
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
        status: 'COMPLETED',
        receivedAt: new Date(),
        totalAmount,
        note: dto.note,
      });

      const savedTransfer = await transferRepo.save(transfer);

      for (const detail of detailsToSave) {
        detail.transferId = savedTransfer.id;
        await detailRepo.save(detail);
      }

      await this.stockVoucherService.createVoucher({
        branchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        type: 'EXPORT',
        note: dto.note || `Xuất kho chuyển đến chi nhánh ${dto.toBranchId}`,
        items: voucherItems,
      });

      await this.stockVoucherService.createVoucher({
        branchId: dto.toBranchId,
        fromBranchId: dto.fromBranchId,
        type: 'IMPORT',
        note: dto.note || `Nhập kho chuyển từ chi nhánh ${dto.fromBranchId}`,
        items: voucherItems,
      });

      return transferRepo.findOne({
        where: { id: savedTransfer.id },
        relations: ['fromBranch', 'toBranch', 'details', 'details.product'],
      });
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
        throw new BadRequestException(
          `StockTransfer is already in ${transfer.status} status`,
        );
      }

      const fromStock = await this.stockService.getOrCreateBranchStock(
        transfer.fromBranchId,
        trx,
      );
      const toStock = await this.stockService.getOrCreateBranchStock(
        transfer.toBranchId,
        trx,
      );

      for (const detail of transfer.details) {
        if (detail.productId) {
          // Subtract from source stock
          await this.updateStockItemQuantity(
            stockItemRepo,
            fromStock.id,
            detail.productId,
            -Number(detail.quantity),
          );
          // Add to destination stock
          await this.updateStockItemQuantity(
            stockItemRepo,
            toStock.id,
            detail.productId,
            Number(detail.quantity),
          );
        }
      }

      transfer.status = 'COMPLETED';
      transfer.receivedAt = new Date();
      await transferRepo.save(transfer);

      return this.findOne(id);
    });
  }
}
