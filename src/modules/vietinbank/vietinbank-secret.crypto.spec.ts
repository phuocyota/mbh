import {
  decryptVietinBankSecret,
  encryptVietinBankSecret,
  parseVietinBankMasterKey,
} from './vietinbank-secret.crypto';

describe('VietinBank secret encryption', () => {
  const key = Buffer.alloc(32, 7);

  it('round-trips a secret with AES-256-GCM without storing plaintext', () => {
    const encrypted = encryptVietinBankSecret('super-secret-value', key);

    expect(encrypted.ciphertext).not.toContain('super-secret-value');
    expect(decryptVietinBankSecret(encrypted, key)).toBe('super-secret-value');
  });

  it('rejects a modified authentication tag', () => {
    const encrypted = encryptVietinBankSecret('super-secret-value', key);

    expect(() =>
      decryptVietinBankSecret(
        { ...encrypted, authTag: Buffer.alloc(16, 1).toString('base64') },
        key,
      ),
    ).toThrow();
  });

  it('requires an exact 32-byte Base64 master key', () => {
    expect(parseVietinBankMasterKey(key.toString('base64'))).toEqual(key);
    expect(() =>
      parseVietinBankMasterKey(Buffer.alloc(16).toString('base64')),
    ).toThrow('Base64-encoded 32-byte key');
  });
});
