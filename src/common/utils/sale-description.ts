export const SALE_REASON_CODES = [
  'BH_CASH',
  'BH_BANK',
  'BH_WALLET',
  'BH_CARD',
  'BH_TRA_CHAM',
];

export function saleDescription(
  kind: 'export' | 'receipt',
  code: string,
  note?: string | null,
) {
  const description =
    kind === 'export'
      ? `Xuất bán theo đơn ${code}`
      : `Thu tiền đơn hàng ${code}`;
  let extra = note?.trim();
  // Replace previous automatic labels; retain notes actually entered by the user.
  if (
    extra &&
    /^(STOCK_EXPORT$|Xuất (kho|bán) theo đơn |Thu tiền đơn hàng )/i.test(extra)
  ) {
    extra = extra
      .split(/\nGhi chú:\s*/)
      .slice(1)
      .join('\nGhi chú: ');
  }
  return extra ? `${description}\nGhi chú: ${extra}` : description;
}
