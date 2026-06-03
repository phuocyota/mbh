export const SOCKET_EVENTS = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status-changed',
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
