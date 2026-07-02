import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { POSDevice } from '../../entities/pos-device.entity';
import { BaseService } from '../../common/sql/base.service';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class POSDeviceService extends BaseService<POSDevice> {
  constructor(
    @InjectRepository(POSDevice)
    private posDeviceRepository: Repository<POSDevice>,
  ) {
    super(posDeviceRepository);
  }

  protected getEntityName(): string {
    return 'POSDevice';
  }

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const where: FindOptionsWhere<POSDevice> = {};

    if (branchId) {
      where.branchId = branchId;
    }

    const [data, total] = await this.posDeviceRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }
}
