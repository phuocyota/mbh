import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from '../../entities/student-profile.entity';
import { BaseService } from '../../common/sql/base.service';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

@Injectable()
export class StudentProfileService extends BaseService<StudentProfile> {
  constructor(
    @InjectRepository(StudentProfile)
    private studentProfileRepository: Repository<StudentProfile>,
  ) {
    super(studentProfileRepository);
  }

  protected getEntityName(): string {
    return 'StudentProfile';
  }

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const query = this.studentProfileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.customer', 'customer')
      .leftJoin('users', 'customerUser', 'customerUser.id = customer.user_id')
      .orderBy('profile.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    if (branchId) {
      query.andWhere('customerUser.branch_id = :branchId', { branchId });
    }

    const [data, total] = await query.getManyAndCount();
    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }
}
