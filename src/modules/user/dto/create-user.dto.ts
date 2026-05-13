import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+84123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Password hash',
    example: 'hashed_password_here',
  })
  @IsNotEmpty()
  @IsString()
  passwordHash: string;

  @ApiProperty({
    description: 'User role',
    enum: ['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN', 'STAFF'],
    default: 'STAFF',
  })
  @IsOptional()
  @IsEnum(['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN', 'STAFF'])
  role?: string;

  @ApiProperty({
    description: 'User status',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}
