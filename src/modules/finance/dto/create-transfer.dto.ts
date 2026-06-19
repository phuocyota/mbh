import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsNotEmpty()
  @IsUUID()
  fromFundId: string;

  @ApiProperty({ example: 'a58cc10b-58cc-4372-a567-0e02b2c3d480' })
  @IsNotEmpty()
  @IsUUID()
  toFundId: string;

  @ApiProperty({ example: 100000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
