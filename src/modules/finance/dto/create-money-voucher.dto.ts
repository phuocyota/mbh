import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateMoneyVoucherDto {
  @ApiProperty({ example: 'RECEIPT' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsNotEmpty()
  @IsUUID()
  fundId: string;

  @ApiProperty({ example: 100000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty({ example: 'ORDER_PAYMENT', required: false })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  debitAccountCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  creditAccountCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  refType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  refId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}