import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

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
}
