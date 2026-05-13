import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from '../../entities/shift.entity';
import { BaseService } from '../../common/sql/base.service';

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
}
