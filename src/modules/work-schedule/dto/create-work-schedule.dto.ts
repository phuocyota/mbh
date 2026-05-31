import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsIn, IsDateString } from 'class-validator';

export class CreateWorkScheduleDto {
  @ApiProperty({ example: 'uuid-of-employee', description: 'Employee ID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '2026-01-05', description: 'Ngày làm việc (YYYY-MM-DD)' })
  @IsDateString()
  workDate: string;

  @ApiProperty({ example: 'morning', enum: ['morning', 'afternoon', 'full'] })
  @IsIn(['morning', 'afternoon', 'full'])
  shift: string;

  @ApiProperty({ example: '', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
