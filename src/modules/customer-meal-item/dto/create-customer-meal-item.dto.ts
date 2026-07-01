import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  ACTIVE_INACTIVE_STATUS_VALUES,
  COMMON_STATUS,
} from '../../../common/constant/constant';

export class CreateCustomerMealItemDto {
  @ApiProperty({
    description: 'Customer ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Meal item ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsNotEmpty()
  @IsUUID()
  mealItemId: string;

  @ApiProperty({
    description: 'Requested quantity',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({
    description: 'Customer meal item status',
    enum: ACTIVE_INACTIVE_STATUS_VALUES,
    default: COMMON_STATUS.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsIn(ACTIVE_INACTIVE_STATUS_VALUES)
  status?: string;

  @ApiProperty({
    description: 'Customer-specific note',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
