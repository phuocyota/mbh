import { createHash } from 'crypto';
export function stableJson(value: any): string {
  if (Array.isArray(value))
    return (
      '[' +
      value.map((v) => stableJson(v === undefined ? null : v)).join(',') +
      ']'
    );
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableJson(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function requestFingerprint(value: any) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
