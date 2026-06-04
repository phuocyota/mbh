export const SOCKET_EVENTS = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status-changed',
  ORDER_ITEM_ADDED: 'order:item-added',
  ORDER_PAYMENT_RECEIVED: 'order:payment-received',
  ORDER_PAID: 'order:paid',
  ORDER_PREPARING: 'order:preparing',
  ORDER_READY_TO_PICKUP: 'order:ready-to-pickup',
  ORDER_COMPLETED: 'order:completed',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_REFUNDED: 'order:refunded',
  ORDER_DELETED: 'order:deleted',
  DASHBOARD_UPDATED: 'dashboard:updated',
} as const;

export const SOCKET_ROOMS = {
  ALL_ORDERS: 'orders:all',
  DASHBOARD: 'dashboard',
  branchOrders: (branchId: string) => `orders:branch:${branchId}`,
  branchDashboard: (branchId: string) => `dashboard:branch:${branchId}`,
  order: (orderId: string) => `order:${orderId}`,
} as const;
