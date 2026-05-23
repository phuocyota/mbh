import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class StudentLoginDto {
  @ApiProperty({
    description: 'Card ID for student login',
    example: '0089280076',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiProperty({
    description: 'Email for student login (alternative to cardId)',
    example: 'student1@pos.local',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Password (required if using email)',
    example: 'student123',
    required: false,
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({
    description: 'Device ID',
    example: 'device-12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
