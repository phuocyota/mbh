import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll } from '../../entities';
import { BaseService } from '../../common/sql/base.service';

interface FindAllOptions {
  status?: string;
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

  async findAll(options?: FindAllOptions): Promise<Payroll[]> {
    const where: any = {};
    
    if (options?.status && options.status !== 'all') {
      where.status = options.status;
    }
    
    return this.payrollRepository.find({ 
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async generateCode(): Promise<string> {
    const count = await this.payrollRepository.count();
    const nextNumber = count + 1;
    return `BL${String(nextNumber).padStart(6, '0')}`;
  }
}
