import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { BaseService } from '../../common/sql/base.service';
import {
  normalizePagination,
  PaginationResponseDto,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

@Injectable()
export class EmployeeService extends BaseService<Employee> {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {
    super(employeeRepository);
  }

  protected getEntityName(): string {
    return 'Employee';
  }

  async findAll(
    status?: string,
    page?: number | string,
    size?: number | string,
  ): Promise<PaginationResponseDto<Employee>> {
    const pagination = normalizePagination(page, size);
    const where: any = {};
    if (status) where.status = status;
    const [data, total] = await this.employeeRepository.findAndCount({
      where,
      order: { code: 'ASC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }
}
