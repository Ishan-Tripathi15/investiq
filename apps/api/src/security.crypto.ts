import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY is not configured');
  const value = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (value.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return value;
}

export function encryptField(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptField(encoded: string): string {
  const [version, ivText, tagText, dataText] = encoded.split('.');
  if (version !== 'v1' || !ivText || !tagText || !dataText) throw new Error('Invalid encrypted field');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}

export function hashOpaque(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
