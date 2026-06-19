import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { BaseService } from '../../common/sql/base.service';
import { COMMON_STATUS } from '../../common/constant/constant';

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

  async findAll(): Promise<Branch[]> {
    const branches = await this.branchRepository.find({
      where: { status: COMMON_STATUS.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    const seenNames = new Set<string>();
    return branches.filter((branch) => {
      const normalizedName = branch.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return true;
    });
  }
}
