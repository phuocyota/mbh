import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class StockTransactionDto extends BaseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  branchId: string;

  @ApiProperty({
    description: 'Product ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  productId: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'IN',
  })
  transactionType: string;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
  })
  quantity: number;

  @ApiProperty({
    description: 'Reference ID',
    example: 'PO123',
  })
  referenceId?: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Stock received from supplier',
  })
  notes?: string;
}
