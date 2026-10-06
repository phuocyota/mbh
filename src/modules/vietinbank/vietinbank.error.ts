import { HttpException, HttpStatus } from '@nestjs/common';

export type VietinBankErrorCode =
  | 'VIETINBANK_CONFIG_NOT_FOUND'
  | 'VIETINBANK_CONFIG_INACTIVE'
  | 'VIETINBANK_SECRET_NOT_FOUND'
  | 'VIETINBANK_ACCOUNT_NOT_FOUND'
  | 'CANTEEN_FORBIDDEN';

export class VietinBankException extends HttpException {
  constructor(
    code: VietinBankErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ success: false, code, message }, status);
  }
}
