import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { BaseService } from '../../common/sql/base.service';

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
}
