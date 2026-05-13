import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRefundItemDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  refundId: string;

  @ApiProperty({
    description: 'Order Item ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  orderItemId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 25000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Reason for refund',
    example: 'Damaged item',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
