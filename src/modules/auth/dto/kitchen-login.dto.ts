import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class KitchenLoginDto {
  @ApiProperty({ description: 'Kitchen email', example: 'kitchen@mbh.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Kitchen password' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Device ID',
    example: 'kitchen-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
