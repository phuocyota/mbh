import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class CashMovementDto extends BaseDto {
  @ApiProperty({
    description: 'Shift ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  shiftId: string;

  @ApiProperty({
    description: 'Movement type',
    example: 'DEPOSIT',
  })
  movementType: string;

  @ApiProperty({
    description: 'Amount',
    example: 100000,
  })
  amount: number;

  @ApiProperty({
    description: 'Notes',
    example: 'Cash deposit from manager',
  })
  notes?: string;
}
