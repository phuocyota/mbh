import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SOCKET_ROOMS } from './socket-events.constant';
import { SocketService } from './socket.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketService: SocketService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.socketService.setServer(server);
  }

  handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      String(client.handshake.headers.authorization || '').replace(
        /^Bearer\s+/i,
        '',
      );
    try {
      const payload = this.jwtService.verify(token);
      client.data.user = {
        userId: payload.userId ?? payload.sub,
        userType: payload.userType ?? payload.role,
        branchId: payload.branchId ?? null,
      };
      if (client.data.user.branchId) {
        void client.join(SOCKET_ROOMS.branchKitchen(client.data.user.branchId));
      }
    } catch {
      void client.disconnect(true);
      return;
    }
    if (client.data.user.userType !== 'KITCHEN') {
      void client.join(SOCKET_ROOMS.ALL_ORDERS);
      void client.join(SOCKET_ROOMS.DASHBOARD);
    }
  }

  handleDisconnect(client: Socket) {
    client.removeAllListeners();
  }

  @SubscribeMessage('orders:join')
  handleJoinOrders(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string; orderId?: string },
  ) {
    if (client.data.user?.userType === 'KITCHEN') return { ok: true };
    if (!client.data.user?.branchId) void client.join(SOCKET_ROOMS.ALL_ORDERS);

    const branchId = client.data.user?.branchId || payload?.branchId;
    if (
      payload?.branchId &&
      client.data.user?.branchId &&
      payload.branchId !== client.data.user.branchId
    ) {
      return { ok: false, error: 'CROSS_BRANCH_FORBIDDEN' };
    }
    if (branchId) {
      void client.join(SOCKET_ROOMS.branchOrders(branchId));
    }

    if (payload?.orderId) {
      void client.join(SOCKET_ROOMS.order(payload.orderId));
    }

    return { ok: true };
  }

  @SubscribeMessage('orders:leave')
  handleLeaveOrders(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string; orderId?: string },
  ) {
    if (payload?.branchId) {
      void client.leave(SOCKET_ROOMS.branchOrders(payload.branchId));
    }

    if (payload?.orderId) {
      void client.leave(SOCKET_ROOMS.order(payload.orderId));
    }

    return { ok: true };
  }

  @SubscribeMessage('dashboard:join')
  handleJoinDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string },
  ) {
    if (client.data.user?.userType === 'KITCHEN') {
      return { ok: false, error: 'KITCHEN_DASHBOARD_FORBIDDEN' };
    }
    if (!client.data.user?.branchId) void client.join(SOCKET_ROOMS.DASHBOARD);

    const branchId = client.data.user?.branchId || payload?.branchId;
    if (
      payload?.branchId &&
      client.data.user?.branchId &&
      payload.branchId !== client.data.user.branchId
    ) {
      return { ok: false, error: 'CROSS_BRANCH_FORBIDDEN' };
    }
    if (branchId) {
      void client.join(SOCKET_ROOMS.branchDashboard(branchId));
    }

    return { ok: true };
  }

  @SubscribeMessage('dashboard:leave')
  handleLeaveDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string },
  ) {
    if (payload?.branchId) {
      void client.leave(SOCKET_ROOMS.branchDashboard(payload.branchId));
    }

    return { ok: true };
  }
}
