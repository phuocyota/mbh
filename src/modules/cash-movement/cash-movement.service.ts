import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashMovement } from '../../entities/cash-movement.entity';
import { BaseService } from '../../common/sql/base.service';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class CashMovementService extends BaseService<CashMovement> {
  constructor(
    @InjectRepository(CashMovement)
    private cashMovementRepository: Repository<CashMovement>,
  ) {
    super(cashMovementRepository);
  }

  protected getEntityName(): string {
    return 'CashMovement';
  }

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const query = this.cashMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.shift', 'shift')
      .orderBy('movement.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    if (branchId) {
      query.andWhere('shift.branchId = :branchId', { branchId });
    }

    const [data, total] = await query.getManyAndCount();
    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findByShift(shiftId: string): Promise<CashMovement[]> {
    return this.cashMovementRepository.find({
      where: { shiftId },
    });
  }
}
