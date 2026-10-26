import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateWorkScheduleDto } from './create-work-schedule.dto';

export class ImportWorkSchedulesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkScheduleDto)
  schedules: CreateWorkScheduleDto[];

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
