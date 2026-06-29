import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ORDER_TYPE, PAYMENT_METHOD } from '../../../common/constant/constant';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

const CART_PAYMENT_METHODS = [PAYMENT_METHOD.WALLET, PAYMENT_METHOD.CASH, PAYMENT_METHOD.MOMO];
const CART_ORDER_TYPES = [ORDER_TYPE.TAKEAWAY, ORDER_TYPE.PRE_ORDER];

export class CompleteCartDto {
  @ApiProperty({
    description: 'Branch ID',
    required: false,
    example: DEFAULT_BRANCH_ID,
    default: DEFAULT_BRANCH_ID,
  })
  @Transform(({ value }) => value || undefined)
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ description: 'POS Device ID', required: false })
  @Transform(({ value }) => value || undefined)
  @IsOptional()
  @IsUUID()
  posDeviceId?: string;

  @ApiProperty({
    description: 'Payment method',
    enum: CART_PAYMENT_METHODS,
    default: PAYMENT_METHOD.WALLET,
    required: false,
  })
  @IsOptional()
  @IsIn(CART_PAYMENT_METHODS)
  paymentMethod?: (typeof CART_PAYMENT_METHODS)[number];

  @ApiProperty({
    description: 'Order type: TAKEAWAY = lấy ngay, PRE_ORDER = ra chơi lấy',
    enum: CART_ORDER_TYPES,
    default: ORDER_TYPE.TAKEAWAY,
    required: false,
  })
  @IsOptional()
  @IsIn(CART_ORDER_TYPES)
  orderType?: (typeof CART_ORDER_TYPES)[number];

  @ApiProperty({ description: 'Coupon ID', required: false })
  @Transform(({ value }) => value || undefined)
  @IsOptional()
  @IsUUID()
  couponId?: string;

  @ApiProperty({ description: 'Order note', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
