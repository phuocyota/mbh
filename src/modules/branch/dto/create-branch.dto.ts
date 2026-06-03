import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import {
  ACTIVE_INACTIVE_STATUS_VALUES,
  COMMON_STATUS,
} from '../../../common/constant/constant';

export class CreateBranchDto {
  @ApiProperty({
    description: 'Branch name',
    example: 'Main Branch',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Branch address',
    example: '123 Main Street, City',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Branch status',
    enum: ACTIVE_INACTIVE_STATUS_VALUES,
    default: COMMON_STATUS.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ACTIVE_INACTIVE_STATUS_VALUES)
  status?: string;
}
