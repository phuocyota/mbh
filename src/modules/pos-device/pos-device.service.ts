import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { POSDevice } from '../../entities/pos-device.entity';
import { BaseService } from '../../common/sql/base.service';

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
}
