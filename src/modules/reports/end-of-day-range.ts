import { BadRequestException } from '@nestjs/common';

const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function resolveEndOfDayRange(
  query: { from?: string; to?: string },
  now = new Date(),
) {
  const today = new Date(now.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  const end = query.to || today;
  const to = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(end) ? `${end}T23:59:59.999+07:00` : end,
  );
  if (!Number.isFinite(to.getTime())) {
    throw new BadRequestException('Khoảng thời gian báo cáo không hợp lệ');
  }
  const endDay = new Date(to.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  const defaultFrom = new Date(
    new Date(`${endDay}T00:00:00+07:00`).getTime() -
      30 * DAY_MS +
      VIETNAM_OFFSET_MS,
  )
    .toISOString()
    .slice(0, 10);
  const start = query.from || defaultFrom;
  const from = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(start) ? `${start}T00:00:00.000+07:00` : start,
  );
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from > to
  ) {
    throw new BadRequestException('Khoảng thời gian báo cáo không hợp lệ');
  }
  return { from, to };
}
