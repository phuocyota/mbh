import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { Employee } from '../../entities/employee.entity';
import { WorkScheduleService } from './work-schedule.service';
import { WorkScheduleController } from './work-schedule.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkSchedule, Employee])],
  controllers: [WorkScheduleController],
  providers: [WorkScheduleService],
  exports: [WorkScheduleService],
})
export class WorkScheduleModule {}
