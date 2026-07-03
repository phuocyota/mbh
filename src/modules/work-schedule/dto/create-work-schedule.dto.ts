import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsDateString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateWorkScheduleDto {
  @ApiProperty({ example: 'uuid-of-employee', description: 'Employee ID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '2026-01-05', description: 'Ngày làm việc (YYYY-MM-DD)' })
  @IsDateString()
  workDate: string;

  @ApiProperty({ example: 'morning', enum: ['morning', 'afternoon', 'full', 'custom'] })
  @IsIn(['morning', 'afternoon', 'full', 'custom'])
  shift: string;

  @ApiProperty({
    example: '08:00',
    required: false,
    description: 'Gio bat dau khi shift = custom (HH:mm)',
  })
  @ValidateIf((dto) => dto.shift === 'custom')
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @ApiProperty({
    example: '12:00',
    required: false,
    description: 'Gio ket thuc khi shift = custom (HH:mm)',
  })
  @ValidateIf((dto) => dto.shift === 'custom')
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @ApiProperty({ example: '', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
