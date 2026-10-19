import { resolveEndOfDayRange } from './end-of-day-range';

describe('End of day report in Vietnam time', () => {
  it('includes local midnight through the last millisecond of today', () => {
    const { from, to } = resolveEndOfDayRange({
      from: '2026-10-19',
      to: '2026-10-19',
    });
    expect(from.toISOString()).toBe('2026-10-18T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-19T16:59:59.999Z');
    expect(new Date('2026-10-19T00:01:00+07:00') >= from).toBe(true);
    expect(new Date('2026-10-20T00:00:00+07:00') > to).toBe(true);
  });
  it('uses the Vietnam calendar day before 7am when UTC is still yesterday', () => {
    const { to } = resolveEndOfDayRange({}, new Date('2026-10-18T18:00:00Z'));
    expect(to.toISOString()).toBe('2026-10-19T16:59:59.999Z');
  });
  it('preserves explicitly supplied datetime boundaries', () => {
    const { from, to } = resolveEndOfDayRange({
      from: '2026-10-19T08:00:00+07:00',
      to: '2026-10-19T12:00:00+07:00',
    });
    expect(from.toISOString()).toBe('2026-10-19T01:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-19T05:00:00.000Z');
  });
  it('rejects invalid dates with a client-facing error', () => {
    expect(() => resolveEndOfDayRange({ to: 'invalid-date' })).toThrow(
      'Khoảng thời gian',
    );
    expect(() => resolveEndOfDayRange({ from: 'invalid-date' })).toThrow(
      'Khoảng thời gian',
    );
  });
  it('rejects a reversed range', () => {
    expect(() =>
      resolveEndOfDayRange({ from: '2026-10-20', to: '2026-10-19' }),
    ).toThrow('Khoảng thời gian');
  });
});
