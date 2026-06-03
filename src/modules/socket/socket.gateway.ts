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

  constructor(private readonly socketService: SocketService) {}

  afterInit(server: Server) {
    this.socketService.setServer(server);
  }

  handleConnection(client: Socket) {
    client.join(SOCKET_ROOMS.ALL_ORDERS);
    client.join(SOCKET_ROOMS.DASHBOARD);
  }

  handleDisconnect(client: Socket) {
    client.removeAllListeners();
  }

  @SubscribeMessage('orders:join')
  handleJoinOrders(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string; orderId?: string },
  ) {
    client.join(SOCKET_ROOMS.ALL_ORDERS);

    if (payload?.branchId) {
      client.join(SOCKET_ROOMS.branchOrders(payload.branchId));
    }

    if (payload?.orderId) {
      client.join(SOCKET_ROOMS.order(payload.orderId));
    }

    return { ok: true };
  }

  @SubscribeMessage('orders:leave')
  handleLeaveOrders(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string; orderId?: string },
  ) {
    if (payload?.branchId) {
      client.leave(SOCKET_ROOMS.branchOrders(payload.branchId));
    }

    if (payload?.orderId) {
      client.leave(SOCKET_ROOMS.order(payload.orderId));
    }

    return { ok: true };
  }

  @SubscribeMessage('dashboard:join')
  handleJoinDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string },
  ) {
    client.join(SOCKET_ROOMS.DASHBOARD);

    if (payload?.branchId) {
      client.join(SOCKET_ROOMS.branchDashboard(payload.branchId));
    }

    return { ok: true };
  }

  @SubscribeMessage('dashboard:leave')
  handleLeaveDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { branchId?: string },
  ) {
    if (payload?.branchId) {
      client.leave(SOCKET_ROOMS.branchDashboard(payload.branchId));
    }

    return { ok: true };
  }
}
