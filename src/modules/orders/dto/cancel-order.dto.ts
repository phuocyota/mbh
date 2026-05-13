import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({
    description: 'Cancel reason',
    example: 'Không có lý do',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Is refunded',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRefunded?: boolean;
}
