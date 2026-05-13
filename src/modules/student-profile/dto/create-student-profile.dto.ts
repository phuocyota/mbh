import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateStudentProfileDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Student ID',
    example: 'STU12345',
  })
  @IsNotEmpty()
  @IsString()
  studentId: string;

  @ApiProperty({
    description: 'School/University name',
    example: 'ABC University',
    required: false,
  })
  @IsOptional()
  @IsString()
  schoolName?: string;

  @ApiProperty({
    description: 'Class/Grade',
    example: '10A',
    required: false,
  })
  @IsOptional()
  @IsString()
  classGrade?: string;

  @ApiProperty({
    description: 'Enrollment date',
    example: '2023-09-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;
}
