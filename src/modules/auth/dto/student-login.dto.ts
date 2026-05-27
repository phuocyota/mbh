import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class StudentLoginDto {
  @ApiProperty({
    description: 'Card ID for student login (no password needed)',
    example: '0089280076',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiProperty({
    description: 'Username - can be email or student code (required with password)',
    example: 'student1@pos.local or STU5000',
    required: false,
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'Password (required if using username)',
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
