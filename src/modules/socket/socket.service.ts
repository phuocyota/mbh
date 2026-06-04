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

  emitOrderItemAdded(order: any, item: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_ITEM_ADDED, { order, item });
  }

  emitOrderPaymentReceived(order: any, payment?: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_PAYMENT_RECEIVED, {
      order,
      payment,
    });
  }

  emitOrderPaid(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_PAID, order);
  }

  emitOrderPreparing(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_PREPARING, order);
  }

  emitOrderReadyToPickup(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_READY_TO_PICKUP, order);
  }

  emitOrderCompleted(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_COMPLETED, order);
  }

  emitOrderCancelled(
    order: any,
    meta?: { reason?: string; isRefunded?: boolean },
  ) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_CANCELLED, { order, ...meta });
  }

  emitOrderRefunded(order: any) {
    this.emitOrderEvent(SOCKET_EVENTS.ORDER_REFUNDED, order);
  }

  emitOrderDeleted(payload: { id: string; branchId?: string | null }) {
    if (!this.server) {
      return;
    }

    this.server
      .to(SOCKET_ROOMS.ALL_ORDERS)
      .emit(SOCKET_EVENTS.ORDER_DELETED, payload);
    this.server
      .to(SOCKET_ROOMS.DASHBOARD)
      .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, payload);

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

    const eventOrder = order.order || order;
    if (!eventOrder?.id) {
      return;
    }

    this.server.to(SOCKET_ROOMS.ALL_ORDERS).emit(event, order);
    this.server.to(SOCKET_ROOMS.order(eventOrder.id)).emit(event, order);
    this.server
      .to(SOCKET_ROOMS.DASHBOARD)
      .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, order);

    if (eventOrder.branchId) {
      this.server
        .to(SOCKET_ROOMS.branchOrders(eventOrder.branchId))
        .emit(event, order);
      this.server
        .to(SOCKET_ROOMS.branchDashboard(eventOrder.branchId))
        .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, order);
    }
  }
}
