import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class MealItemDto extends BaseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  branchId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  productId: string;

  @ApiProperty({
    description: 'Meal period',
    example: 'BREAKFAST',
  })
  mealPeriod: string;

  @ApiProperty({
    description: 'Menu level',
    example: 'primary',
  })
  level: string;

  @ApiProperty({
    description: 'Day of week from JavaScript getDay(): 0 Sunday, 6 Saturday',
    required: false,
  })
  dayOfWeek?: number;

  @ApiProperty({
    description: 'Menu date key',
    required: false,
  })
  dateKey?: string;

  @ApiProperty({
    description: 'Sort order inside the meal period',
    example: 1,
  })
  sortOrder: number;

  @ApiProperty({
    description: 'Expected quantity for this meal item in the meal period',
    example: 50,
  })
  expectedQuantity: number;

  @ApiProperty({
    description: 'Meal item status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Note',
    required: false,
  })
  note?: string;
}
