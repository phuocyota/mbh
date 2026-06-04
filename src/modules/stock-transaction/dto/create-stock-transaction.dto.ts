import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
} from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class CreateStockTransactionDto {
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
    description: 'Transaction type',
    example: 'IN',
  })
  @IsNotEmpty()
  @IsString()
  transactionType: string;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
  })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Reference ID',
    example: 'PO123',
    required: false,
  })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Stock received from supplier',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
