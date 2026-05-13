import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class StudentProfileDto extends BaseDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  customerId: string;

  @ApiProperty({
    description: 'Class ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  classId?: string;

  @ApiProperty({
    description: 'Student code',
    example: 'STU12345',
  })
  studentCode?: string;

  @ApiProperty({
    description: 'Student full name',
    example: 'Nguy?n V?n A',
  })
  fullName?: string;
}
