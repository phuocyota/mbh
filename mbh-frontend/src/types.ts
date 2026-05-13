export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  unit?: string;
  category?: { id: string; name: string };
}

export interface Category {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  name: string;
}

export interface POSDevice {
  id: string;
  branchId: string;
  deviceCode: string;
  deviceName: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  fullName: string;
  phone?: string;
  type: string;
  status: string;
}

export interface WalletInfo {
  walletId: string;
  customerId: string;
  balance: number;
  status: string;
}

export interface WalletTx {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  refType: string;
  note?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  subtotal: number;
  paidAmount: number;
  createdAt: string;
  customer?: { id: string; fullName: string };
  items?: any[];
  payments?: any[];
}

export interface RevenueSummary {
  orderCount: number;
  totalRevenue: number;
  totalDiscount: number;
  refundCount: number;
  refundAmount: number;
  netRevenue: number;
  paymentBreakdown: { method: string; count: number; amount: number }[];
}

export interface DailyRow {
  day: string;
  orderCount: number;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface CardScanResult {
  customer: { id: string; fullName: string; customerCode: string };
  card: { cardUid: string };
  wallet: { id: string; balance: number; status: string } | null;
}

export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export interface CheckoutResult {
  order: { orderCode: string; status: string; totalAmount: number };
  wallet: { balanceAfter: number };
}

export interface DashboardData {
  revenue: {
    total: number;
    today: number;
    trend: number;
  };
  orders: {
    total: number;
    processing: number;
    completed: number;
  };
  inventory: {
    total: number;
    lowStock: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    sold: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderId: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
}

export type Stage = 'IDLE' | 'LOADING' | 'MENU' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
