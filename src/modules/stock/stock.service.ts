import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Stock } from '../../entities/stock.entity';
import { Branch } from '../../entities/branch.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
  ) {}

  /**
   * Find or auto-create the Stock record for a given branch.
   * Pass an EntityManager to participate in an existing transaction.
   */
  async getOrCreateBranchStock(
    branchId: string,
    manager?: EntityManager,
  ): Promise<Stock> {
    const stockRepo = manager
      ? manager.getRepository(Stock)
      : this.stockRepository;
    let stock = await stockRepo.findOne({ where: { branchId } });
    if (!stock) {
      const branchRepo = manager
        ? manager.getRepository(Branch)
        : this.stockRepository.manager.getRepository(Branch);
      const branch = await branchRepo.findOne({ where: { id: branchId } });
      const branchName = branch?.name || branchId;
      stock = await stockRepo.save(
        stockRepo.create({
          name: `Kho Chi Nhánh ${branchName}`,
          branchId,
        }),
      );
    }
    return stock;
  }
}
