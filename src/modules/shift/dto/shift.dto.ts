import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class ShiftDto extends BaseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  branchId: string;

  @ApiProperty({
    description: 'Cashier ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  cashierId: string;

  @ApiProperty({
    description: 'Start time',
    example: '2024-01-15T08:00:00Z',
  })
  startTime: Date;

  @ApiProperty({
    description: 'End time',
    example: '2024-01-15T17:00:00Z',
  })
  endTime?: Date;

  @ApiProperty({
    description: 'Shift status',
    example: 'OPEN',
  })
  status: string;
}
