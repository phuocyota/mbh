import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { BaseService } from '../../common/sql/base.service';
import {
  normalizePagination,
  PaginationResponseDto,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

@Injectable()
export class WalletTransactionService extends BaseService<WalletTransaction> {
  constructor(
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
  ) {
    super(walletTransactionRepository);
  }

  protected getEntityName(): string {
    return 'WalletTransaction';
  }

  override async findAll(
    page?: any,
    size?: any,
    search?: string,
    type?: string,
  ): Promise<PaginationResponseDto<WalletTransaction>> {
    const pagination = normalizePagination(page, size);
    const query = this.walletTransactionRepository
      .createQueryBuilder('wt')
      .leftJoinAndSelect('wt.customer', 'customer')
      .leftJoinAndSelect('wt.createdByUser', 'createdByUser')
      .orderBy('wt.createdAt', 'DESC');

    if (search) {
      const s = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(customer.fullName) LIKE :s OR LOWER(customer.customerCode) LIKE :s OR LOWER(wt.note) LIKE :s)',
        { s },
      );
    }

    if (type && type !== 'all') {
      query.andWhere('wt.type = :type', { type });
    }

    const [idRows, total] = await Promise.all([
      query
        .clone()
        .select('wt.id', 'id')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      query.clone().getCount(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const walletTransactions = await this.walletTransactionRepository.find({
      where: { id: In(ids) },
      relations: ['customer', 'createdByUser'],
    });

    const walletTransactionById = new Map(
      walletTransactions.map((walletTransaction) => [
        walletTransaction.id,
        walletTransaction,
      ]),
    );
    const data = ids
      .map((id) => walletTransactionById.get(id))
      .filter(
        (walletTransaction): walletTransaction is WalletTransaction =>
          !!walletTransaction,
      );

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }
}
