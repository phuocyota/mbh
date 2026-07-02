import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';
import {
  ACTIVE_INACTIVE_STATUS_VALUES,
  COMMON_STATUS,
} from '../../../common/constant/constant';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Beverages',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Category description',
    example: 'All beverages and drinks',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Sort order',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    description: 'Category status',
    enum: ACTIVE_INACTIVE_STATUS_VALUES,
    default: COMMON_STATUS.ACTIVE,
  })
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Branch ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
