import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class SelectCustomerMealItemDto {
  @ApiProperty({
    description: 'Meal item ID selected from the admin menu',
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
    description: 'Customer-specific note',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
