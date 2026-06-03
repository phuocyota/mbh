import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from './socket-events.constant';

@Injectable()
export class SocketService {
  private server?: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitOrderCreated(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_CREATED, order);
  }

  emitOrderUpdated(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_UPDATED, order);
  }

  emitOrderStatusChanged(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_STATUS_CHANGED, order);
  }

  emitOrderDeleted(payload: { id: string; branchId?: string | null }) {
    if (!this.server) {
      return;
    }

    this.server.to(SOCKET_ROOMS.ALL_ORDERS).emit(SOCKET_EVENTS.ORDER_DELETED, payload);
    this.server.to(SOCKET_ROOMS.DASHBOARD).emit(SOCKET_EVENTS.DASHBOARD_UPDATED, payload);

    if (payload.branchId) {
      this.server
        .to(SOCKET_ROOMS.branchOrders(payload.branchId))
        .emit(SOCKET_EVENTS.ORDER_DELETED, payload);
      this.server
        .to(SOCKET_ROOMS.branchDashboard(payload.branchId))
        .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, payload);
    }
  }

  private emitOrderEvent(event: string, order: any) {
    if (!this.server || !order) {
      return;
    }

    this.server.to(SOCKET_ROOMS.ALL_ORDERS).emit(event, order);
    this.server.to(SOCKET_ROOMS.order(order.id)).emit(event, order);
    this.server.to(SOCKET_ROOMS.DASHBOARD).emit(SOCKET_EVENTS.DASHBOARD_UPDATED, order);

    if (order.branchId) {
      this.server.to(SOCKET_ROOMS.branchOrders(order.branchId)).emit(event, order);
      this.server
        .to(SOCKET_ROOMS.branchDashboard(order.branchId))
        .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, order);
    }
  }
}
