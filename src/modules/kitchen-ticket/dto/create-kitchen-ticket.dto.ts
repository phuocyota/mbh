import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateKitchenTicketDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Ticket number',
    example: 'KT001',
  })
  @IsNotEmpty()
  @IsString()
  ticketNumber: string;

  @ApiProperty({
    description: 'Ticket status',
    enum: ['PENDING', 'COOKING', 'READY', 'COMPLETED'],
    default: 'PENDING',
  })
  @IsOptional()
  @IsEnum(['PENDING', 'COOKING', 'READY', 'COMPLETED'])
  status?: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Urgent order',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
