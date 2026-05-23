import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashMovement } from '../../entities/cash-movement.entity';
import { BaseService } from '../../common/sql/base.service';

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

  async findByShift(shiftId: string): Promise<CashMovement[]> {
    return this.cashMovementRepository.find({
      where: { shiftId },
    });
  }
}
