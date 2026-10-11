import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmpty,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { VIETINBANK_ACCOUNT_STATUSES } from '../../../entities/vietinbank-account.entity';
import {
  VIETINBANK_CONFIG_STATUSES,
  VIETINBANK_ENVIRONMENTS,
} from '../../../entities/vietinbank-integration-config.entity';

class ForbiddenPlaintextSecretsDto {
  @ApiHideProperty()
  @IsEmpty({ message: 'clientSecret must not be sent through this API' })
  clientSecret?: never;

  @ApiHideProperty()
  @IsEmpty({ message: 'privateKey must not be sent through this API' })
  privateKey?: never;
}

export class CreateVietinBankConfigDto extends ForbiddenPlaintextSecretsDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ enum: VIETINBANK_ENVIRONMENTS })
  @IsIn(VIETINBANK_ENVIRONMENTS)
  environment: 'UAT' | 'PROD';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  providerId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  merchantId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gatewayId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clientId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  clientSecretRef: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  partnerPrivateKeyRef: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerPublicKey?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bankPublicKey: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  apiBaseUrl: string;

  @ApiPropertyOptional({ enum: VIETINBANK_CONFIG_STATUSES })
  @IsOptional()
  @IsIn(VIETINBANK_CONFIG_STATUSES)
  status?: 'ACTIVE' | 'INACTIVE';
}

export class UpdateVietinBankConfigDto extends ForbiddenPlaintextSecretsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gatewayId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerPublicKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bankPublicKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  apiBaseUrl?: string;
}

export class UpdateVietinBankSecretsDto extends ForbiddenPlaintextSecretsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  clientSecretRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  partnerPrivateKeyRef?: string;
}

export class UpdateVietinBankStatusDto {
  @ApiProperty({ enum: VIETINBANK_CONFIG_STATUSES })
  @IsIn(VIETINBANK_CONFIG_STATUSES)
  status: 'ACTIVE' | 'INACTIVE';
}

export class CreateVietinBankAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountType?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateVietinBankAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: VIETINBANK_ACCOUNT_STATUSES })
  @IsOptional()
  @IsIn(VIETINBANK_ACCOUNT_STATUSES)
  status?: 'ACTIVE' | 'INACTIVE';
}
