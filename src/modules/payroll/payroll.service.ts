import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll } from '../../entities';
import { BaseService } from '../../common/sql/base.service';
import { PAYROLL_STATUS_FILTER_ALL } from '../../common/constant/constant';
import {
  normalizePagination,
  PaginationResponseDto,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

interface FindAllOptions {
  status?: string;
  branchId?: string;
  page?: number | string;
  size?: number | string;
}

@Injectable()
export class PayrollService extends BaseService<Payroll> {
  constructor(
    @InjectRepository(Payroll)
    private payrollRepository: Repository<Payroll>,
  ) {
    super(payrollRepository);
  }

  protected getEntityName(): string {
    return 'Payroll';
  }

  async findAll(options?: FindAllOptions): Promise<PaginationResponseDto<Payroll>> {
    const pagination = normalizePagination(options?.page, options?.size);
    const where: any = {};
    
    const status = options?.status?.toUpperCase();
    if (status && status !== PAYROLL_STATUS_FILTER_ALL) {
      where.status = status;
    }

    if (options?.branchId) {
      where.branchId = options.branchId;
    }
    
    const [data, total] = await this.payrollRepository.findAndCount({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async generateCode(): Promise<string> {
    const count = await this.payrollRepository.count();
    const nextNumber = count + 1;
    return `BL${String(nextNumber).padStart(6, '0')}`;
  }
}
