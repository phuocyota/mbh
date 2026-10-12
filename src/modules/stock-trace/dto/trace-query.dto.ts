import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LotMovementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class ProductLotsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number = 20;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'EXPIRED', 'EXPIRING_SOON'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['FIFO', 'FEFO', 'QUANTITY'] })
  @IsOptional()
  @IsString()
  sortBy?: string = 'FEFO';
}

export class IngredientTraceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  finishedGoodLotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class TraceabilityReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  includeIngredients?: boolean = true;
}

export class ExpiringLotsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsInt()
  @Min(1)
  withinDays: number = 30;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productType?: string;
}

export class ConsumedLotsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  finishedGoodLotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
