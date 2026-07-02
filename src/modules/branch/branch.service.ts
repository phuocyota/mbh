import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { BaseService } from '../../common/sql/base.service';
import { COMMON_STATUS } from '../../common/constant/constant';
import {
  normalizePagination,
  PaginationResponseDto,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

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

  async findAll(
    page?: number | string,
    size?: number | string,
  ): Promise<PaginationResponseDto<Branch>> {
    const pagination = normalizePagination(page, size);
    const branches = await this.branchRepository.find({
      where: { status: COMMON_STATUS.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    const seenNames = new Set<string>();
    const uniqueBranches = branches.filter((branch) => {
      const normalizedName = branch.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return true;
    });

    return toPaginationResponse(
      uniqueBranches.slice(pagination.skip, pagination.skip + pagination.size),
      uniqueBranches.length,
      pagination.page,
      pagination.size,
    );
  }
}
