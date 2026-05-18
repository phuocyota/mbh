import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CashierLoginDto {
  @ApiProperty({
    description: 'Cashier email',
    example: 'cashier1@pos.local',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Cashier password',
    example: 'cashier123',
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Device ID',
    example: 'pos-counter-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
