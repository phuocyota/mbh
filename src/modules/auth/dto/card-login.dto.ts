import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CardLoginDto {
  @ApiProperty({
    description: 'Card ID for login (RFID card number)',
    example: '0089280076',
  })
  @IsNotEmpty()
  @IsString()
  cardId: string;

  @ApiProperty({
    description: 'Device ID',
    example: 'device-12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
