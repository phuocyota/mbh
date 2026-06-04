import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class CreateShiftDto {
  @ApiProperty({
    description: 'Branch ID',
    example: DEFAULT_BRANCH_ID,
    required: false,
    default: DEFAULT_BRANCH_ID,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    description: 'Cashier ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  cashierId: string;

  @ApiProperty({
    description: 'Start time',
    example: '2024-01-15T08:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'End time',
    example: '2024-01-15T17:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiProperty({
    description: 'Shift status',
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN',
  })
  @IsOptional()
  @IsEnum(['OPEN', 'CLOSED'])
  status?: string;
}
