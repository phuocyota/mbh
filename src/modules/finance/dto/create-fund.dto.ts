import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class CreateFundDto {
  @ApiProperty({ example: DEFAULT_BRANCH_ID, required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: 'TM' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Tiền mặt' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '1111' })
  @IsNotEmpty()
  @IsString()
  accountCode: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;
}
