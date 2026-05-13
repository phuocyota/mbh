import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional } from 'class-validator';

export class CreateStudentProfileDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Class ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiProperty({
    description: 'Student code',
    example: 'STU12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiProperty({
    description: 'Student full name',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullName?: string;
}
