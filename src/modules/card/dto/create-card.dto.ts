import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateCardDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Card UID',
    example: 'CARD123456',
  })
  @IsNotEmpty()
  @IsString()
  cardUid: string;

  @ApiProperty({
    description: 'Card number',
    example: '0123456789ABCDEF',
  })
  @IsNotEmpty()
  @IsString()
  cardNumber: string;

  @ApiProperty({
    description: 'Card status',
    enum: ['ACTIVE', 'LOST', 'BLOCKED'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'LOST', 'BLOCKED'])
  status?: string;

  @ApiProperty({
    description: 'Issued date',
    example: '2024-01-15T00:00:00Z',
    required: false,
  })
  @IsOptional()
  issuedAt?: Date;
}
