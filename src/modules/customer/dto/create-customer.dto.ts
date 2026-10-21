import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import {
  ACTIVE_INACTIVE_STATUS_VALUES,
  COMMON_STATUS,
  CUSTOMER_TYPE,
  CUSTOMER_TYPE_VALUES,
} from '../../../common/constant/constant';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer code',
    example: 'CUST001',
  })
  @IsNotEmpty()
  @IsString()
  customerCode: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+84123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Customer type',
    enum: CUSTOMER_TYPE_VALUES,
    default: CUSTOMER_TYPE.GUEST,
  })
  @IsOptional()
  @IsEnum(CUSTOMER_TYPE_VALUES)
  type?: string;

  @ApiProperty({
    description: 'Customer status',
    enum: ACTIVE_INACTIVE_STATUS_VALUES,
    default: COMMON_STATUS.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ACTIVE_INACTIVE_STATUS_VALUES)
  status?: string;

  @ApiProperty({
    description:
      'Maximum total debt for this customer; defaults to 50000 and is not changed by wallet transactions',
    example: 50000,
    required: false,
    default: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50000)
  debtLimit?: number;
}
