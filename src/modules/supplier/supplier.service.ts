import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, Like } from 'typeorm';
import { Supplier, Debt } from '../../entities';
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
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
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

  /**
   * Ghi nhận mua hàng từ nhà cung cấp (cộng totalPurchase).
   */
  async recordPurchase(
    supplierId: string,
    amount: number,
    manager?: EntityManager,
  ): Promise<Supplier> {
    const repo = manager
      ? manager.getRepository(Supplier)
      : this.supplierRepository;

    const supplier = await repo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException(`Supplier not found: ${supplierId}`);
    }

    supplier.totalPurchase = Number(supplier.totalPurchase || 0) + amount;
    return repo.save(supplier);
  }

  /**
   * Ghi nợ nhà cung cấp: cộng debt + tạo Debt record + cộng totalPurchase.
   */
  async recordPurchaseDebt(
    params: {
      supplierId: string;
      amount: number;
      refType: string;
      refId: string;
      note?: string;
    },
    manager?: EntityManager,
  ): Promise<{ supplier: Supplier; debt: Debt }> {
    const supplierRepo = manager
      ? manager.getRepository(Supplier)
      : this.supplierRepository;
    const debtRepo = manager
      ? manager.getRepository(Debt)
      : this.debtRepository;

    const supplier = await supplierRepo.findOne({
      where: { id: params.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier not found: ${params.supplierId}`);
    }

    supplier.totalPurchase = Number(supplier.totalPurchase || 0) + params.amount;

    const nextDebt = Number(supplier.debt || 0) + params.amount;
    supplier.debt = nextDebt;
    await supplierRepo.save(supplier);

    const debtRecord = await debtRepo.save(
      debtRepo.create({
        supplierId: supplier.id,
        type: 'PURCHASE',
        amount: params.amount,
        balanceAfter: nextDebt,
        refType: params.refType,
        refId: params.refId,
        note: params.note,
      }),
    );

    return { supplier, debt: debtRecord };
  }
}

