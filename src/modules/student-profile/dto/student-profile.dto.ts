import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class StudentProfileDto extends BaseDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  customerId: string;

  @ApiProperty({
    description: 'Student ID',
    example: 'STU12345',
  })
  studentId: string;

  @ApiProperty({
    description: 'School/University name',
    example: 'ABC University',
  })
  schoolName?: string;

  @ApiProperty({
    description: 'Class/Grade',
    example: '10A',
  })
  classGrade?: string;

  @ApiProperty({
    description: 'Enrollment date',
    example: '2023-09-01T00:00:00Z',
  })
  enrollmentDate?: Date;
}
