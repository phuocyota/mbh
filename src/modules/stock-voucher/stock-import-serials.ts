import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateStockVoucherItemDto } from './dto/create-stock-voucher.dto';

export function prepareImportSerials(
  item: CreateStockVoucherItemDto,
  type: string,
  baseQuantity: number,
): { serialMode: string; serials: string[] } {
  const serialMode = item.serialMode || 'NONE';
  if (serialMode === 'NONE') {
    if (item.serials?.length)
      throw new BadRequestException('Vui lòng chọn nhập serial thủ công.');
    return { serialMode, serials: [] };
  }
  if (type !== 'IMPORT')
    throw new BadRequestException('Chỉ hỗ trợ khai báo serial khi nhập kho.');
  if (
    !Number.isInteger(baseQuantity) ||
    baseQuantity < 1 ||
    baseQuantity > 10000 ||
    baseQuantity !== Number(item.quantity)
  )
    throw new BadRequestException(
      'Hàng có serial phải nhập theo đơn vị cơ sở với số lượng nguyên từ 1 đến 10000.',
    );
  if (serialMode === 'AUTO') {
    if (item.serials?.length)
      throw new BadRequestException(
        'Không gửi serial thủ công khi chọn tự sinh.',
      );
    return {
      serialMode,
      serials: Array.from({ length: baseQuantity }, () => randomUUID()),
    };
  }
  if (serialMode !== 'MANUAL')
    throw new BadRequestException('Lựa chọn xử lý serial không hợp lệ.');
  const serials = (item.serials || []).map((serial) => serial.trim());
  if (
    serials.length !== baseQuantity ||
    serials.some((serial) => !serial || serial.length > 128)
  )
    throw new BadRequestException(
      'Mỗi đơn vị nhập phải có một serial, tối đa 128 ký tự.',
    );
  if (new Set(serials).size !== serials.length)
    throw new BadRequestException(
      'Serial trong dòng hàng không được trùng nhau.',
    );
  return { serialMode, serials };
}
