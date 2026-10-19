import { TraceLookupService } from './trace-lookup.service';
import { TraceLookupController } from './trace-lookup.controller';

const uuid = '00000000-0000-4000-8000-000000000001';
function harness(lots: any[] = [], rows: any[] = []) {
  const db: any = { query: jest.fn(async () => lots) };
  const serials: any = {
    list: jest.fn(async () => ({ total: rows.length, data: rows })),
  };
  const trace: any = { getFullTrace: jest.fn(async (q) => ({ lot: q })) };
  return {
    db,
    serials,
    trace,
    service: new TraceLookupService(db, serials, trace),
  };
}
describe('single identifier trace lookup', () => {
  it('resolves scoped lot UUIDs', async () => {
    const h = harness([{ id: uuid }]);
    expect(await h.service.lookup('branch', uuid)).toMatchObject({
      type: 'LOT',
      id: uuid,
    });
    expect(h.db.query).toHaveBeenCalledWith(
      expect.stringContaining('s.branch_id=$2'),
      [uuid, 'branch'],
    );
    expect(h.trace.getFullTrace).toHaveBeenCalledWith({ lotId: uuid });
  });
  it.each(['MANUAL-001', uuid])(
    'resolves exact serial including UUID-shaped AUTO values %s',
    async (serial) => {
      const h = harness(
        [],
        [
          {
            serial,
            detailId: uuid,
            position: 1,
            lotId: 'lot',
            receiptCode: 'NK1',
            supplierName: 'NCC',
          },
        ],
      );
      const result = await h.service.lookup('branch', ` ${serial} `);
      expect(result).toMatchObject({
        type: 'SERIAL',
        id: serial,
        serial: {
          receiptCode: 'NK1',
          supplierName: 'NCC',
          serialMovementTrackingSupported: false,
        },
        lotTrace: { lot: { lotId: 'lot' } },
      });
      expect(h.serials.list).toHaveBeenCalledWith('branch', {
        serial,
        size: 20,
      });
    },
  );
  it('returns serials without a lot', async () => {
    const h = harness([], [{ serial: 'SER', lotId: null }]);
    expect(await h.service.lookup('branch', 'SER')).toMatchObject({
      type: 'SERIAL',
      lotTrace: null,
    });
    expect(h.trace.getFullTrace).not.toHaveBeenCalled();
  });
  it.each([
    { rows: [{ serial: 'S' }, { serial: 'S' }] },
    { rows: [{ serial: uuid }] },
  ])(
    'rejects ambiguous identities without choosing arbitrary provenance',
    async ({ rows }) => {
      const h = harness(rows.length === 1 ? [{ id: uuid }] : [], rows);
      try {
        await h.service.lookup('branch', rows[0].serial);
        throw Error('Expected conflict');
      } catch (e) {
        expect(e.getStatus()).toBe(409);
        expect(e.getResponse()).toMatchObject({
          code: 'TRACE_ID_AMBIGUOUS',
          total: 2,
        });
      }
      expect(h.trace.getFullTrace).not.toHaveBeenCalled();
    },
  );
  it('returns 404 for unknown or foreign identifiers', async () => {
    const h = harness();
    await expect(h.service.lookup('branch', uuid)).rejects.toThrow(
      'Không tìm thấy',
    );
    expect(h.trace.getFullTrace).not.toHaveBeenCalled();
  });
  it.each([undefined, [], {}, '', ' ', 'x'.repeat(129)])(
    'validates identifier %j',
    async (value) => {
      const h = harness();
      await expect(h.service.lookup('branch', value)).rejects.toThrow(
        'Vui lòng gửi',
      );
      expect(h.db.query).not.toHaveBeenCalled();
    },
  );
  it('uses JWT branch and forbids branch switching', () => {
    const service: any = { lookup: jest.fn() };
    const c = new TraceLookupController(service);
    const req = { user: { userType: 'MANAGER', branchId: 'branch' } };
    c.lookup(req, { id: 'SER' });
    expect(service.lookup).toHaveBeenCalledWith('branch', 'SER');
    expect(() => c.lookup(req, { id: 'SER', branchId: 'foreign' })).toThrow(
      'CROSS_BRANCH_FORBIDDEN',
    );
    expect(service.lookup).toHaveBeenCalledTimes(1);
  });
});
