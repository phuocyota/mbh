import { KitchenTaskService } from './kitchen-task.service';
import { KitchenOperation, KitchenProductionBatch } from '../../entities';
import {
  assertTaskAction,
  validateBoardingTransport,
} from './kitchen-task.rules';
import { localDate } from '../stock/stock-movement.service';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const arrivalId = '33333333-3333-4333-8333-333333333333';
const route = {
  originPlace: ' Bếp A ',
  destinationPlace: 'Trường B',
  carrierName: 'Anh Nam',
  imageUrl: '/uploads/dispatch.jpg',
};
function harness() {
  const actor = { userId: 'cook', userType: 'KITCHEN', branchId: 'branch' };
  const batch = {
    id,
    source: 'BOARDING',
    actualQuantity: 50,
    details: { servingExpiresAt: new Date(Date.now() + 3600000).toISOString() },
  };
  const flow = {
    id: 'flow',
    status: 'COMPLETED',
    version: 4,
    payload: {
      batchIds: [id],
      requests: {},
      history: [],
      ownerId: 'cook',
    },
  } as any;
  const repo = {
    findOne: jest.fn(async () => flow),
    findOneByOrFail: jest.fn(async () => ({ payload: { lotId: 'lot' } })),
    save: jest.fn(async (value) => {
      value.version++;
      return value;
    }),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === KitchenOperation) return repo;
      if (entity === KitchenProductionBatch)
        return {
          findOne: jest.fn(async () => batch),
          findOneByOrFail: jest.fn(async () => batch),
        };
      throw new Error('Unexpected repository');
    }),
  };
  const ops = { write: jest.fn(async () => ({ id: 'export' })) };
  const service = new KitchenTaskService(
    { transaction: (fn) => fn(manager) } as any,
    { lock: jest.fn() } as any,
    {} as any,
  );
  jest
    .spyOn(service as any, 'source')
    .mockImplementation(async () => ({
      row: batch,
      branchId: 'branch',
      date: localDate(),
      shift: 'Ca trưa',
    }));
  jest.spyOn(service as any, 'detail').mockImplementation(async () => flow);
  jest.spyOn(service as any, 'scoped').mockReturnValue(ops);
  const dispatch = (overrides = {}) =>
    service.action(actor, 'batch', id, 'dispatch', {
      ...route,
      requestId,
      expectedVersion: 4,
      ...overrides,
    });
  const arrive = (overrides = {}) =>
    service.action(actor, 'batch', id, 'handover', {
      requestId: arrivalId,
      expectedVersion: flow.version,
      receivedBy: 'Cô Lan',
      receiverPlace: 'Changed by client',
      items: [{ batchId: id, quantity: 50 }],
      ...overrides,
    });
  return { actor, batch, flow, ops, service, dispatch, arrive };
}

describe('Boarding transport', () => {
  it('exports once at departure, then confirms receipt at the fixed destination', async () => {
    const h = harness();
    await h.dispatch();
    expect(h.flow.status).toBe('IN_TRANSIT');
    expect(h.flow.payload.transport).toMatchObject({
      ...route,
      originPlace: 'Bếp A',
      exportId: 'export',
      servingExpiresAt: h.batch.details.servingExpiresAt,
    });
    expect(h.ops.write).toHaveBeenCalledWith(
      h.actor,
      'finished-exports',
      expect.objectContaining({
        quantity: 50,
        receivedBy: 'Anh Nam',
        receiverPlace: 'Trường B',
      }),
    );
    await h.dispatch(); // Retry after response loss, with the original request/version.
    expect(h.ops.write).toHaveBeenCalledTimes(1);
    await h.arrive();
    expect(h.flow.status).toBe('HANDED_OVER');
    expect(h.flow.payload.handover).toMatchObject({
      receivedBy: 'Cô Lan',
      receiverPlace: 'Trường B',
    });
    expect(h.flow.payload.transport.receivedAt).toBeDefined();
    expect(h.ops.write).toHaveBeenCalledTimes(1);
    await h.arrive({ expectedVersion: 5 });
    expect(h.ops.write).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, null, '', '   ', 123, 'x'.repeat(2049)])(
    'rejects departure without a valid photo %p before exporting stock',
    async (imageUrl) => {
      const h = harness();
      await expect(h.dispatch({ imageUrl })).rejects.toThrow('Cần chụp ảnh');
      expect(h.ops.write).not.toHaveBeenCalled();
      expect(h.flow.status).toBe('COMPLETED');
    },
  );
  it('preserves direct handover for meals served on site', async () => {
    const h = harness();
    await h.arrive();
    expect(h.flow.status).toBe('HANDED_OVER');
    expect(h.ops.write).toHaveBeenCalledTimes(1);
    expect(h.flow.payload.transport).toBeUndefined();
  });
  it('rejects dispatch for non-boarding batches and invalid routes', async () => {
    const h = harness();
    h.batch.source = 'MANUAL';
    await expect(h.dispatch()).rejects.toThrow('Chỉ vận chuyển mẻ bán trú');
    expect(h.ops.write).not.toHaveBeenCalled();
    for (const dto of [
      { ...route, carrierName: '' },
      { ...route, destinationPlace: 'bếp a' },
      { ...route, originPlace: 'x'.repeat(201) },
    ])
      expect(() =>
        validateBoardingTransport('batch', 'BOARDING', dto),
      ).toThrow();
    expect(() =>
      validateBoardingTransport('ticket', 'BOARDING', route),
    ).toThrow();
  });
  it('requires QC completion and prevents another dispatch while in transit', async () => {
    const h = harness();
    expect(() => assertTaskAction('RECORDED', 'dispatch')).toThrow();
    await h.dispatch();
    await expect(
      h.dispatch({ requestId: arrivalId, expectedVersion: 5 }),
    ).rejects.toThrow();
    expect(() => assertTaskAction('HANDED_OVER', 'dispatch')).toThrow();
  });
  it('rejects stale versions, non-owner actions and incomplete arrival quantities', async () => {
    const h = harness();
    await expect(h.dispatch({ expectedVersion: 3 })).rejects.toThrow();
    h.flow.payload.ownerId = 'other-cook';
    await expect(h.dispatch()).rejects.toThrow('nhân viên khác');
    h.flow.payload.ownerId = 'cook';
    await h.dispatch();
    await expect(
      h.arrive({ items: [{ batchId: id, quantity: 49 }] }),
    ).rejects.toThrow('giao đủ');
    expect(h.flow.status).toBe('IN_TRANSIT');
  });
  it.each([null, 'invalid', new Date(0).toISOString()])(
    'blocks departure with invalid or expired serving expiry %p',
    async (expiry) => {
      const h = harness();
      h.batch.details.servingExpiresAt = expiry as any;
      await expect(h.dispatch()).rejects.toThrow('hạn sử dụng');
      expect(h.ops.write).not.toHaveBeenCalled();
    },
  );
  it('keeps serving expiry and blocks serving food that expired during transport', async () => {
    const h = harness();
    await h.dispatch();
    h.flow.payload.transport.servingExpiresAt = new Date(0).toISOString();
    await expect(h.arrive()).rejects.toThrow('hết hạn sử dụng');
    expect(h.flow.status).toBe('IN_TRANSIT');
    expect(h.ops.write).toHaveBeenCalledTimes(1);
  });
});
