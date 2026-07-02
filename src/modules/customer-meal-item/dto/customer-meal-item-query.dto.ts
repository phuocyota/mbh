import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  COMMON_STATUS_VALUES,
  MEAL_PERIOD_VALUES,
} from '../../../common/constant/constant';

export class CustomerMealItemQueryDto {
  @ApiPropertyOptional({ type: 'number', example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ type: 'number', example: 10 })
  @IsOptional()
  size?: number;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by meal item ID' })
  @IsOptional()
  @IsUUID()
  mealItemId?: string;

  @ApiPropertyOptional({ description: 'Filter by branch ID from meal item' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by meal period from meal item',
    enum: MEAL_PERIOD_VALUES,
  })
  @IsOptional()
  @IsIn(MEAL_PERIOD_VALUES)
  mealPeriod?: string;

  @ApiPropertyOptional({ description: 'Filter by meal item level' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: 'Filter by day of week from meal item',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Filter by meal item date key' })
  @IsOptional()
  @IsString()
  dateKey?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer meal item status',
    enum: COMMON_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(COMMON_STATUS_VALUES)
  status?: string;
}
