import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from '../../entities/student-profile.entity';
import { BaseService } from '../../common/sql/base.service';

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
}
