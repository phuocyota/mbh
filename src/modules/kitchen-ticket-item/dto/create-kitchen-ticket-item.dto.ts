import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
} from 'class-validator';

export class CreateKitchenTicketItemDto {
  @ApiProperty({
    description: 'Kitchen Ticket ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  kitchenTicketId: string;

  @ApiProperty({
    description: 'Product ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Item status',
    enum: ['PENDING', 'COOKING', 'READY', 'COMPLETED'],
    default: 'PENDING',
  })
  @IsOptional()
  @IsEnum(['PENDING', 'COOKING', 'READY', 'COMPLETED'])
  status?: string;

  @ApiProperty({
    description: 'Cooking notes',
    example: 'Extra hot, no sugar',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
