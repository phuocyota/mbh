import { BadRequestException, ConflictException } from '@nestjs/common';

export const TASK_FLOW = {
  migrate: 'LEGACY',
  wait: 'WAITING',
  receive: 'WAITING',
  start: 'RECEIVED',
  record: 'PREPARING',
  complete: 'RECORDED',
  dispatch: 'COMPLETED',
  handover: 'COMPLETED',
  'handover-partial': 'WAITING',
} as const;
export function assertTaskAction(status: string, action: string) {
  if (status === 'IN_TRANSIT' && action === 'handover') return;
  if (status === 'RECORDED' && action === 'record') return;
  if (!Object.prototype.hasOwnProperty.call(TASK_FLOW, action))
    throw new BadRequestException('Thao tác không hợp lệ.');
  if (TASK_FLOW[action] !== status)
    throw new ConflictException(
      'Nhiệm vụ đã thay đổi trạng thái. Vui lòng làm mới.',
    );
}
export function taskNumber(value: unknown, allowZero = false) {
  if (!['number', 'string'].includes(typeof value))
    throw new BadRequestException('Số lượng không hợp lệ.');
  const n = Number(value);
  if (
    (typeof value === 'string' && value.trim() === '') ||
    value === null ||
    value === undefined ||
    !Number.isFinite(n) ||
    (allowZero ? n < 0 : n <= 0)
  )
    throw new BadRequestException('Số lượng không hợp lệ.');
  if (Math.abs(n - Number(n.toFixed(4))) > 1e-9)
    throw new BadRequestException(
      'Số lượng chỉ được tối đa 4 chữ số thập phân.',
    );
  return n;
}
export function validateTaskActuals(
  issued: number,
  used: number,
  waste: number,
) {
  if (used + waste > issued + 0.00005)
    throw new BadRequestException('Lượng dùng và hao hụt vượt lượng đã nhận.');
  return Number((issued - used - waste).toFixed(4));
}

/** Boarding transport stays inside the task's branch; places are delivery addresses. */
export function validateBoardingTransport(
  type: string,
  source: string,
  dto: any,
) {
  if (type !== 'batch' || source !== 'BOARDING')
    throw new BadRequestException('Chỉ vận chuyển mẻ bán trú.');
  const fields = ['originPlace', 'destinationPlace', 'carrierName'] as const;
  const result = {} as Record<(typeof fields)[number], string>;
  for (const field of fields) {
    if (
      typeof dto[field] !== 'string' ||
      !dto[field].trim() ||
      dto[field].trim().length > 200
    )
      throw new BadRequestException(
        'Cần điểm chế biến, điểm nhận và người vận chuyển (tối đa 200 ký tự).',
      );
    result[field] = dto[field].trim();
  }
  if (
    result.originPlace.toLocaleLowerCase() ===
    result.destinationPlace.toLocaleLowerCase()
  )
    throw new BadRequestException('Điểm chế biến và điểm nhận phải khác nhau.');
  if (typeof dto.imageUrl !== 'string' || !dto.imageUrl.trim() || dto.imageUrl.length > 2048)
    throw new BadRequestException('Cần chụp ảnh thành phẩm trước khi bắt đầu vận chuyển.');
  return { ...result, imageUrl: dto.imageUrl.trim() };
}
