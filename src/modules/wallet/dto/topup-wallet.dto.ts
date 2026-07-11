import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TopupWalletDto {
  @ApiProperty({
    description: 'Customer ID (chủ ví)',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Số tiền nạp',
    example: 100000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description:
      'Quy nhan tien. Bat buoc khi khoan nap dung de thu cong no vi am.',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiProperty({
    description: 'Ghi chú',
    example: 'Phụ huynh nạp tiền',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RepayCustomerDebtCashDto {
  @ApiProperty({
    description: 'Customer ID trả nợ',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Số tiền khách trả bằng tiền mặt',
    example: 50000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description:
      'Quỹ tiền mặt nhận tiền. Nếu không truyền sẽ tự chọn quỹ tiền mặt active theo chi nhánh khách hàng.',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiProperty({
    description: 'Ghi chú',
    example: 'Khách trả nợ bằng tiền mặt',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class WalletBalanceDto {
  @ApiProperty({ description: 'Wallet ID' })
  walletId: string;

  @ApiProperty({ description: 'Customer ID' })
  customerId: string;

  @ApiProperty({ description: 'Số dư hiện tại', example: 250000 })
  balance: number;

  @ApiProperty({ description: 'Trạng thái ví', example: 'ACTIVE' })
  status: string;
}
