import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const [data, total] = await query
      .skip(pagination.skip)
      .take(pagination.size)
      .getManyAndCount();

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }
}
