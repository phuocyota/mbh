import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  isUUID,
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';
import {
  STOCK_PARTY_TYPE,
  STOCK_PAYMENT_STATUS,
  STOCK_VOUCHER_TYPE,
} from '../stock-voucher.constants';

function UniqueStockVoucherItemProducts(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'uniqueStockVoucherItemProducts',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (!Array.isArray(value)) {
            return false;
          }

          const productIds = value
            .map((item) => item?.productId)
            .filter((productId): productId is string => !!productId);

          return new Set(productIds).size === productIds.length;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not contain duplicate productId`;
        },
      },
    });
  };
}

function RequireSupplierImportSourceId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requireSupplierImportSourceId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const dto = args.object as CreateStockVoucherDto;
          const type = String(dto.type || '').toUpperCase();
          const partyType = String(
            dto.sourceType || dto.toType || '',
          ).toUpperCase();
          const hasSourceId =
            _value !== undefined && _value !== null && _value !== '';
          const hasFallbackToId = Boolean(dto.toId);

          if (
            type === STOCK_VOUCHER_TYPE.IMPORT &&
            partyType === STOCK_PARTY_TYPE.SUPPLIER
          ) {
            return (
              (hasSourceId || hasFallbackToId) &&
              (!hasSourceId || isUUID(String(_value)))
            );
          }

          return !hasSourceId || isUUID(String(_value));
        },
        defaultMessage(args: ValidationArguments) {
          const hasSourceId =
            args.value !== undefined &&
            args.value !== null &&
            args.value !== '';

          if (hasSourceId) {
            return 'sourceId must be a UUID';
          }

          return 'Supplier sourceId is required for supplier import';
        },
      },
    });
  };
}

function RequireSupplierImportPaymentStatus(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requireSupplierImportPaymentStatus',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const dto = args.object as CreateStockVoucherDto;
          const type = String(dto.type || '').toUpperCase();
          const partyType = String(
            dto.sourceType || dto.toType || '',
          ).toUpperCase();
          const hasValue = value !== undefined && value !== null && value !== '';
          const isAllowedPaymentStatus = [
            STOCK_PAYMENT_STATUS.PAID,
            STOCK_PAYMENT_STATUS.UNPAID,
            STOCK_PAYMENT_STATUS.DEBT,
          ].includes(String(value || '').toUpperCase() as any);

          if (
            type === STOCK_VOUCHER_TYPE.IMPORT &&
            partyType === STOCK_PARTY_TYPE.SUPPLIER
          ) {
            return hasValue && isAllowedPaymentStatus;
          }

          return !hasValue || isAllowedPaymentStatus;
        },
        defaultMessage() {
          return 'paymentStatus must be PAID, UNPAID or DEBT for supplier import';
        },
      },
    });
  };
}

export class CreateStockVoucherItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 10000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateStockVoucherDto {
  @ApiProperty({ example: DEFAULT_BRANCH_ID, required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fromBranchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  toBranchId?: string;

  @ApiProperty({ example: STOCK_VOUCHER_TYPE.IMPORT })
  @IsNotEmpty()
  @IsIn(Object.values(STOCK_VOUCHER_TYPE))
  type: string;

  @ApiProperty({
    required: false,
    description: 'Destination ID (e.g. supplier, customer)',
  })
  @IsOptional()
  @IsUUID()
  toId?: string;

  @ApiProperty({
    required: false,
    description: 'Destination type (e.g. supplier, customer)',
  })
  @IsOptional()
  @IsString()
  toType?: string;

  @ApiProperty({
    required: false,
    description: `${STOCK_VOUCHER_TYPE.IMPORT}: source, ${STOCK_VOUCHER_TYPE.EXPORT}: destination.`,
  })
  @RequireSupplierImportSourceId()
  sourceId?: string;

  @ApiProperty({
    required: false,
    description: `Business source/destination type. Examples: ${STOCK_PARTY_TYPE.SUPPLIER}, ${STOCK_PARTY_TYPE.CUSTOMER}, ${STOCK_PARTY_TYPE.BRANCH}, VENDOR.`,
  })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiProperty({ required: false, description: 'Reference ID (e.g. order ID)' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiProperty({ required: false, description: 'Reference type (e.g. order)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiProperty({
    required: false,
    description:
      'Legacy optional. Supplier imports resolve fund from reason accounting_formula and branchId.',
  })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiProperty({
    required: false,
    description:
      'Accounting reason code from stock_fund_receipt_reason. Supplier imports default to NHNCC and are filtered by paymentStatus/isDebt.',
  })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    description: `Payment mode for supplier imports. Use ${STOCK_PAYMENT_STATUS.PAID} for immediate payment; use ${STOCK_PAYMENT_STATUS.UNPAID} or ${STOCK_PAYMENT_STATUS.DEBT} for supplier debt.`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @RequireSupplierImportPaymentStatus()
  paymentStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ type: [CreateStockVoucherItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @UniqueStockVoucherItemProducts()
  @ValidateNested({ each: true })
  @Type(() => CreateStockVoucherItemDto)
  items: CreateStockVoucherItemDto[];
}
