import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import {
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
} from '../../../common/constant/constant';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 100000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
    enum: PAYMENT_METHOD_VALUES,
  })
  @IsNotEmpty()
  @IsEnum(PAYMENT_METHOD_VALUES)
  paymentMethod: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PAYMENT_STATUS_VALUES,
    default: PAYMENT_STATUS.PENDING,
  })
  @IsOptional()
  @IsEnum(PAYMENT_STATUS_VALUES)
  status?: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Paid in full',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
