import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { WorkScheduleService } from './work-schedule.service';
import { WorkScheduleController } from './work-schedule.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkSchedule])],
  controllers: [WorkScheduleController],
  providers: [WorkScheduleService],
  exports: [WorkScheduleService],
})
export class WorkScheduleModule {}
