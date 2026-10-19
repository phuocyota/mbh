import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class KitchenManualLineDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() id?: string;
  @ApiPropertyOptional() @IsUUID() productId: string;
  @ApiPropertyOptional() @IsInt() @Min(1) expectedQuantity: number;
  @ApiPropertyOptional() @IsUUID() stationId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() batchId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['Ca sáng', 'Ca trưa', 'Ca chiều'])
  shift?: string;
  @ApiPropertyOptional() @IsString() serviceArea: string;
  @ApiPropertyOptional() @IsString() plannedStartAt: string;
  @ApiPropertyOptional() @IsString() deadline: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ingredients?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

/** Shared document fields; resource-specific required fields are validated transactionally. */
export class KitchenDocumentDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() batchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() expectedVersion?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() date?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['Ca sáng', 'Ca trưa', 'Ca chiều'])
  shift?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mealPeriod?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  productIds?: string[];
  @ApiPropertyOptional({
    type: [KitchenManualLineDto],
    description:
      'Manual lines: id?, productId, expectedQuantity, plannedStartAt, deadline, stationId, serviceArea, assignedTo?, ingredients?, note?',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitchenManualLineDto)
  items?: KitchenManualLineDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() receiverArea?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receiverPlace?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveredBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receivedBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() importedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sampledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storageStartedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expectedEndAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storageLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pool?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class BatchInputLotDto {
  @ApiPropertyOptional() @IsUUID() lotId: string;
  /** Quantity in the ingredient product's base unit. */
  @ApiPropertyOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;
}

export class KitchenBatchUpdateDto {
  @ApiPropertyOptional({
    type: [BatchInputLotDto],
    description:
      'Actual ingredient/fuel lots consumed at start; quantities in base units',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchInputLotDto)
  inputLots?: BatchInputLotDto[];
  @ApiPropertyOptional() @IsNumber() expectedVersion: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() actualQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() estimatedDoneAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issueNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageName?: string;
}
