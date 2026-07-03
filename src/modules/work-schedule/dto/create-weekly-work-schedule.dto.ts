import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class WeeklyWorkScheduleSlotDto {
  @ApiProperty({
    description: 'Day of week from JavaScript getDay(): 0 Sunday, 6 Saturday',
    example: 1,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

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

export class CreateWeeklyWorkScheduleDto {
  @ApiProperty({ example: 'uuid-of-employee', description: 'Employee ID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '2026-06-29', description: 'Ngay bat dau ap dung (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate: string;

  @ApiProperty({ example: '2026-08-02', description: 'Ngay ket thuc ap dung (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate: string;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Xoa lich cu cua nhan vien tai cac ngay duoc sinh ra truoc khi tao moi',
  })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;

  @ApiProperty({ type: [WeeklyWorkScheduleSlotDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WeeklyWorkScheduleSlotDto)
  weeklyShifts: WeeklyWorkScheduleSlotDto[];
}
