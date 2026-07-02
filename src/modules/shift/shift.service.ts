import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Shift } from '../../entities/shift.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ShiftService extends BaseService<Shift> {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
  ) {
    super(shiftRepository);
  }

  protected getEntityName(): string {
    return 'Shift';
  }

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const where: FindOptionsWhere<Shift> = {};

    if (branchId) {
      where.branchId = branchId;
    }

    const [data, total] = await this.shiftRepository.findAndCount({
      where,
      relations: ['branch', 'posDevice', 'cashier'],
      order: { openedAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findByIdOrThrow(id: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Shift', id),
      );
    }

    return shift;
  }
}
