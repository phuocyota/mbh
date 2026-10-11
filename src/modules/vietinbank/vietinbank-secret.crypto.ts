import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedVietinBankSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
}

export function parseVietinBankMasterKey(value: string | undefined): Buffer {
  if (!value) {
    throw new Error('VIETINBANK_SECRET_MASTER_KEY is required');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'VIETINBANK_SECRET_MASTER_KEY must be a Base64-encoded 32-byte key',
    );
  }
  return key;
}

export function encryptVietinBankSecret(
  plaintext: string,
  masterKey: Buffer,
): EncryptedVietinBankSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    version: 1,
  };
}

export function decryptVietinBankSecret(
  encrypted: EncryptedVietinBankSecret,
  masterKey: Buffer,
): string {
  if (encrypted.version !== 1) {
    throw new Error(
      `Unsupported VietinBank secret version: ${encrypted.version}`,
    );
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(encrypted.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
