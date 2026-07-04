import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ACTIVE_INACTIVE_STATUS_VALUES,
  COMMON_STATUS,
  MEAL_PERIOD,
  MEAL_PERIOD_VALUES,
} from '../../../common/constant/constant';

export class CreateMealItemDto {
  @ApiProperty({
    description: 'Branch ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsNotEmpty()
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Meal period',
    enum: MEAL_PERIOD_VALUES,
    example: MEAL_PERIOD.BREAKFAST,
  })
  @IsNotEmpty()
  @IsIn(MEAL_PERIOD_VALUES)
  mealPeriod: string;

  @ApiProperty({
    description: 'Menu level',
    example: 'primary',
    required: false,
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiProperty({
    description: 'Day of week from JavaScript getDay(): 0 Sunday, 6 Saturday',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({
    description: 'Menu date key',
    example: '2026-07-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  dateKey?: string;

  @ApiProperty({
    description: 'Sort order inside the meal period',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    description: 'Expected quantity for this meal item in the meal period',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedQuantity?: number;

  @ApiProperty({
    description: 'Meal item status',
    enum: ACTIVE_INACTIVE_STATUS_VALUES,
    default: COMMON_STATUS.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsIn(ACTIVE_INACTIVE_STATUS_VALUES)
  status?: string;

  @ApiProperty({
    description: 'Note',
    example: 'Available on weekdays',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
