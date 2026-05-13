import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer code',
    example: 'CUST001',
  })
  @IsNotEmpty()
  @IsString()
  customerCode: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
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
    description: 'Customer type',
    enum: ['STUDENT', 'TEACHER', 'GUEST'],
    default: 'GUEST',
  })
  @IsOptional()
  @IsEnum(['STUDENT', 'TEACHER', 'GUEST'])
  type?: string;

  @ApiProperty({
    description: 'Customer status',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;
}
