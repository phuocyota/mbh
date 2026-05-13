import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class BranchService extends BaseService<Branch> {
  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
  ) {
    super(branchRepository);
  }

  protected getEntityName(): string {
    return 'Branch';
  }
}
