import { SocketGateway } from './socket.gateway';

describe('Kitchen socket role scope', () => {
  it.each(['KITCHEN', 'HEAD_CHEF'])(
    '%s stays in its kitchen branch room',
    (role) => {
      const gateway = new SocketGateway(
        {} as any,
        {
          verify: () => ({ userId: 'u', userType: role, branchId: 'branch1' }),
        } as any,
      );
      const client: any = {
        handshake: { auth: { token: 'test' }, headers: {} },
        data: {},
        join: jest.fn(),
        disconnect: jest.fn(),
      };
      gateway.handleConnection(client);
      expect(client.join.mock.calls).toEqual([['kitchen:branch:branch1']]);
      expect(
        gateway.handleJoinDashboard(client, { branchId: 'branch2' }),
      ).toEqual({ ok: false, error: 'KITCHEN_DASHBOARD_FORBIDDEN' });
      gateway.handleJoinOrders(client, { branchId: 'branch2' });
      expect(client.join.mock.calls).toEqual([['kitchen:branch:branch1']]);
    },
  );
});
