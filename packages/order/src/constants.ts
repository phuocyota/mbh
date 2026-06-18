export const ORDER_STATUS = {
  CANCELLED: 0,
  PREPARING: 1,
  PENDING: 2,
  PENDING_PAYMENT: 3,
  READY_TO_PICKUP: 4,
  DONE: 5,
  REFUNDED: 6,
  DRAFT: 7,
  WAITING: 8,
  READY: 9,
  RECEIVED: 10,
  COMPLETED: 11,
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

export const ORDER_STATUS_NAME_TO_CODE = {
  CANCELLED: ORDER_STATUS.CANCELLED,
  PREPARING: ORDER_STATUS.PREPARING,
  PENDING: ORDER_STATUS.PENDING,
  PENDING_PAYMENT: ORDER_STATUS.PENDING_PAYMENT,
  READY_TO_PICKUP: ORDER_STATUS.READY_TO_PICKUP,
  DONE: ORDER_STATUS.DONE,
  REFUNDED: ORDER_STATUS.REFUNDED,
  DRAFT: ORDER_STATUS.DRAFT,
  WAITING: ORDER_STATUS.WAITING,
  READY: ORDER_STATUS.READY,
  RECEIVED: ORDER_STATUS.RECEIVED,
  COMPLETED: ORDER_STATUS.COMPLETED,
} as const;

export function resolveOrderStatus(value?: string | number | null): OrderStatus | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numericValue = Number(value);
  if (Number.isInteger(numericValue)) {
    return (ORDER_STATUS_VALUES as readonly number[]).includes(numericValue)
      ? (numericValue as OrderStatus)
      : undefined;
  }

  return ORDER_STATUS_NAME_TO_CODE[
    String(value).toUpperCase() as keyof typeof ORDER_STATUS_NAME_TO_CODE
  ];
}

export const REVENUE_ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.READY_TO_PICKUP,
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.DONE,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.WAITING,
] as const;

export const ORDER_PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  REFUNDED: 'REFUNDED',
} as const;

export type OrderPaymentStatus =
  (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS];

export const ORDER_PAYMENT_STATUS_VALUES = Object.values(ORDER_PAYMENT_STATUS);

export const PAYMENT_METHOD = {
  CASH: 'CASH',
  WALLET: 'WALLET',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  QR: 'QR',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);
