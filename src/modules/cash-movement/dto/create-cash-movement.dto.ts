import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateCashMovementDto {
  @ApiProperty({
    description: 'Shift ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  shiftId: string;

  @ApiProperty({
    description: 'Movement type',
    example: 'DEPOSIT',
  })
  @IsNotEmpty()
  @IsString()
  movementType: string;

  @ApiProperty({
    description: 'Amount',
    example: 100000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Notes',
    example: 'Cash deposit from manager',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
