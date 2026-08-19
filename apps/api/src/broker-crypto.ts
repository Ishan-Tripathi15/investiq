import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function encryptionKey(): Buffer {
  const value = process.env.BROKER_TOKEN_ENCRYPTION_KEY?.trim();
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('BROKER_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal secret');
  }
  return Buffer.from(value, 'hex');
}

export function hashBrokerOAuthState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export function encryptBrokerToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptBrokerToken(value: string): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Invalid encrypted broker token');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8');
}
