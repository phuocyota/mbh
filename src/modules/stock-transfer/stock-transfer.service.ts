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
    private movements: StockMovementService,
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
    if (dto.fromBranchId === dto.toBranchId)
      throw new BadRequestException('TRANSFER_SAME_BRANCH');
    return this.stockVoucherService.createVoucher({
      type: 'TRANSFER',
      branchId: dto.fromBranchId,
      fromBranchId: dto.fromBranchId,
      toBranchId: dto.toBranchId,
      items: dto.items,
      note: dto.note,
      requestId: (dto as any).requestId,
      actorId: dto.actorId,
    });
  }

  async complete(id: string, actorId?: string) {
    return this.dataSource.transaction(async (trx) => {
      const transferRepo = trx.getRepository(StockReceiptTransfer);
      await transferRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

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

      for (const branchId of [
        transfer.fromBranchId,
        transfer.toBranchId,
      ].sort())
        await trx.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['stock-branch:' + branchId],
        );
      await this.movements.lockProducts(
        trx,
        transfer.details
          .map((detail) => detail.productId)
          .filter((id): id is string => Boolean(id)),
      );
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
          const product = await trx
            .getRepository(Product)
            .findOneByOrFail({ id: detail.productId });
          if (product.lotTrackingEnabled)
            throw new BadRequestException(
              'LEGACY_DRAFT_TRANSFER_REQUIRES_LOT_REVIEW',
            );
          await this.movements.change(
            trx,
            fromStock.id,
            detail.productId,
            -Number(detail.quantity),
            transfer.id,
          );
          await this.movements.change(
            trx,
            toStock.id,
            detail.productId,
            Number(detail.quantity),
            transfer.id,
          );
        }
      }

      transfer.status = 'COMPLETED';
      transfer.updatedBy = actorId;
      transfer.receivedAt = new Date();
      await transferRepo.save(transfer);

      return transferRepo.findOneOrFail({
        where: { id },
        relations: ['details'],
      });
    });
  }
}
