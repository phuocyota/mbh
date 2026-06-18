import { OrderStatus, OrderPaymentStatus, PaymentMethod } from './constants.js';

export interface OrderItemDraft {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  discountAmount?: number | null;
  subtotal?: number;
  totalAmount?: number;
  note?: string | null;
}

export interface OrderDraft {
  orderCode?: string;
  orderNumber?: number;
  branchId?: string | null;
  customerId?: string | null;
  cashierId?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  couponId?: string | null;
  couponDiscount?: number | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount?: number;
  changeAmount?: number;
  items: OrderItemDraft[];
}
