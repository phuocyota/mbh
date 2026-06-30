import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  COMMON_STATUS_VALUES,
  MEAL_PERIOD_VALUES,
} from '../../../common/constant/constant';

export class MealItemQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by branch ID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by meal period',
    enum: MEAL_PERIOD_VALUES,
  })
  @IsOptional()
  @IsIn(MEAL_PERIOD_VALUES)
  mealPeriod?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: COMMON_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(COMMON_STATUS_VALUES)
  status?: string;
}
