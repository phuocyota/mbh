import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Supplier } from '../../entities';
import { BaseService } from '../../common/sql/base.service';

interface FindAllOptions {
  status?: string;
  search?: string;
}

@Injectable()
export class SupplierService extends BaseService<Supplier> {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {
    super(supplierRepository);
  }

  protected getEntityName(): string {
    return 'Supplier';
  }

  async findAll(options?: FindAllOptions): Promise<Supplier[]> {
    const where: any = {};
    
    if (options?.status && options.status !== 'all') {
      where.status = options.status;
    }
    
    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      return this.supplierRepository.find({
        where: [
          { ...where, code: Like(searchTerm) },
          { ...where, name: Like(searchTerm) },
          { ...where, phone: Like(searchTerm) },
        ],
      });
    }
    
    return this.supplierRepository.find({ where });
  }

  async generateCode(): Promise<string> {
    const count = await this.supplierRepository.count();
    const nextNumber = count + 1;
    return `NCC${String(nextNumber).padStart(6, '0')}`;
  }
}
