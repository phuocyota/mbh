import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteCartDto {
  @ApiProperty({ description: 'Branch ID', required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ description: 'POS Device ID', required: false })
  @IsOptional()
  @IsUUID()
  posDeviceId?: string;

  @ApiProperty({
    description: 'Payment method',
    enum: ['WALLET', 'CASH'],
    default: 'WALLET',
    required: false,
  })
  @IsOptional()
  @IsIn(['WALLET', 'CASH'])
  paymentMethod?: 'WALLET' | 'CASH';

  @ApiProperty({
    description: 'Order type: TAKEAWAY = lấy ngay, PRE_ORDER = ra chơi lấy',
    enum: ['TAKEAWAY', 'PRE_ORDER'],
    default: 'TAKEAWAY',
    required: false,
  })
  @IsOptional()
  @IsIn(['TAKEAWAY', 'PRE_ORDER'])
  orderType?: 'TAKEAWAY' | 'PRE_ORDER';

  @ApiProperty({ description: 'Order note', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
