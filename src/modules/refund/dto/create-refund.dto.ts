import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RefundItemInputDto {
  @ApiProperty({
    description: 'Order Item ID cần hoàn',
    example: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  orderItemId: string;

  @ApiProperty({
    description: 'Số lượng hoàn',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description:
      'Số tiền hoàn cho item này (đã tính thuế/giảm giá nếu có)',
    example: 35000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateRefundDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: 'Refund reason',
    example: 'Khách trả lại món',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    description:
      'Danh sách item cần hoàn. Tổng amount sẽ được cộng thành refundAmount.',
    type: [RefundItemInputDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundItemInputDto)
  items: RefundItemInputDto[];

  @ApiProperty({
    description: 'Refund status',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    default: 'PENDING',
    required: false,
  })
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'])
  status?: string;
}

export class ApproveRefundDto {
  @ApiProperty({
    description: 'Ghi chú duyệt (tùy chọn)',
    required: false,
    example: 'Đã kiểm tra, đồng ý hoàn tiền',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectRefundDto {
  @ApiProperty({
    description: 'Lý do từ chối',
    example: 'Đơn hàng không đủ điều kiện hoàn',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
