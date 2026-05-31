import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { BaseService } from '../../common/sql/base.service';

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

  async findAll(status?: string): Promise<Employee[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.employeeRepository.find({ where, order: { code: 'ASC' } });
  }
}
