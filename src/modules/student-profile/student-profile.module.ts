import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfileService } from './student-profile.service';
import { StudentProfileController } from './student-profile.controller';
import { StudentProfile } from '../../entities/student-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile])],
  providers: [StudentProfileService],
  controllers: [StudentProfileController],
  exports: [StudentProfileService],
})
export class StudentProfileModule {}
