import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsNumber, IsOptional, Min } from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class CreateStockLevelDto {
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
    description: 'Product ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Current quantity',
    example: 50,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Minimum threshold',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minThreshold?: number;

  @ApiProperty({
    description: 'Maximum capacity',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCapacity?: number;
}
