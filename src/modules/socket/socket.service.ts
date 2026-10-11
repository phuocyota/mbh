import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from './socket-events.constant';

@Injectable()
export class SocketService {
  private server?: Server;
  private readonly dashboardRefreshEvents = new Set<string>([
    SOCKET_EVENTS.ORDER_CREATED,
    SOCKET_EVENTS.ORDER_UPDATED,
    SOCKET_EVENTS.ORDER_STATUS_CHANGED,
  ]);

  setServer(server: Server) {
    this.server = server;
  }

  emitCustomerDebtPaid(payload: { customerId: string; transactionId: string }) {
    this.server
      ?.to(SOCKET_ROOMS.DASHBOARD)
      .emit(SOCKET_EVENTS.CUSTOMER_DEBT_PAID, payload);
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

  emitKitchenTicketCreated(ticket: any) {
    if (ticket?.branchId)
      this.server
        ?.to(SOCKET_ROOMS.branchKitchen(ticket.branchId))
        .emit(SOCKET_EVENTS.KITCHEN_TICKET_CREATED, ticket);
  }

  emitKitchenTicketUpdated(ticket: any) {
    if (ticket?.branchId)
      this.server
        ?.to(SOCKET_ROOMS.branchKitchen(ticket.branchId))
        .emit(SOCKET_EVENTS.KITCHEN_TICKET_UPDATED, ticket);
  }

  emitKitchenBatchUpdated(branchId: string, batch: any) {
    this.server
      ?.to(SOCKET_ROOMS.branchKitchen(branchId))
      .emit(SOCKET_EVENTS.KITCHEN_BATCH_UPDATED, batch);
  }

  emitKitchenMealPlanLocked(plan: any) {
    if (plan?.branchId)
      this.server
        ?.to(SOCKET_ROOMS.branchKitchen(plan.branchId))
        .emit(SOCKET_EVENTS.KITCHEN_MEAL_PLAN_LOCKED, plan);
  }

  emitKitchenConsumptionUpdated(branchId: string, session: any) {
    this.server
      ?.to(SOCKET_ROOMS.branchKitchen(branchId))
      .emit(SOCKET_EVENTS.KITCHEN_CONSUMPTION_UPDATED, session);
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

  emitDashboardUpdated(payload: {
    source: string;
    action: string;
    branchId?: string | null;
    entityId?: string;
  }) {
    if (!this.server) {
      return;
    }

    const eventPayload = {
      ...payload,
      occurredAt: new Date().toISOString(),
    };

    this.server
      .to(SOCKET_ROOMS.DASHBOARD)
      .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, eventPayload);

    if (payload.branchId) {
      this.server
        .to(SOCKET_ROOMS.branchDashboard(payload.branchId))
        .emit(SOCKET_EVENTS.DASHBOARD_UPDATED, eventPayload);
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
    if (eventOrder.branchId) {
      this.server
        .to(SOCKET_ROOMS.branchOrders(eventOrder.branchId))
        .emit(event, order);
    }

    // Một thao tác đơn hàng có thể phát nhiều order event liên tiếp. Chỉ các
    // event tổng hợp này mới invalidate dashboard để FE không refetch lặp.
    if (this.dashboardRefreshEvents.has(event)) {
      this.emitDashboardUpdated({
        source: 'order',
        action: event,
        branchId: eventOrder.branchId,
        entityId: eventOrder.id,
      });
    }
  }
}
