import {
  assertTaskAction,
  taskNumber,
  validateTaskActuals,
} from './kitchen-task.rules';

describe('Kitchen task safeguards', () => {
  it.each(['', ' ', null, undefined, true, {}, -1, Infinity, NaN, 0.00001])(
    'rejects invalid quantities %p',
    (value) => {
      expect(() => taskNumber(value, true)).toThrow();
    },
  );
  it('keeps zero waste and four decimal ingredient precision', () => {
    expect(taskNumber('0', true)).toBe(0);
    expect(taskNumber('0.1234')).toBe(0.1234);
    expect(() => taskNumber(0)).toThrow();
    expect(validateTaskActuals(60, 50, 5)).toBe(5);
    expect(() => validateTaskActuals(60, 60, 1)).toThrow();
  });
  it('requires receipt before starting and allows corrections before QC', () => {
    expect(() => assertTaskAction('LEGACY', 'migrate')).not.toThrow();
    expect(() => assertTaskAction('WAITING', 'migrate')).toThrow();
    expect(() => assertTaskAction('WAITING', 'start')).toThrow();
    expect(() => assertTaskAction('RECORDED', 'record')).not.toThrow();
    expect(() => assertTaskAction('COMPLETED', 'record')).toThrow();
    expect(() => assertTaskAction('HANDED_OVER', 'handover')).toThrow();
  });
});
