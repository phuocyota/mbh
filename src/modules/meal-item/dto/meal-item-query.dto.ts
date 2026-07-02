import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  Matches,
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

export class MealItemQueryDto {
  @ApiPropertyOptional({ type: 'number', example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ type: 'number', example: 10 })
  @IsOptional()
  size?: number;

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
    description: 'Filter by menu level',
    example: 'primary',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description:
      'Filter by day of week from JavaScript getDay(): 0 Sunday, 6 Saturday',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Filter by menu date key',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsString()
  dateKey?: string;

  @ApiPropertyOptional({
    description:
      'Filter by menu date key from YYYY-MM-DD. Ignored when dateKey is provided.',
    example: '2026-06-29',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    description:
      'Filter by menu date key to YYYY-MM-DD. Ignored when dateKey is provided.',
    example: '2026-07-05',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: COMMON_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(COMMON_STATUS_VALUES)
  status?: string;
}
