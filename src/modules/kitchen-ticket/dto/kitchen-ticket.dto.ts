import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class KitchenTicketDto extends BaseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  branchId: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  orderId: string;

  @ApiProperty({
    description: 'Ticket number',
    example: 'KT001',
  })
  ticketNumber: string;

  @ApiProperty({
    description: 'Ticket status',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Urgent order',
  })
  notes?: string;
}
