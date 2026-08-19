import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { decryptField, encryptField, hashOpaque } from './security.crypto';
import { MfaRepository } from './mfa.repository';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(input: Buffer): string {
  let bits = 0; let value = 0; let out = '';
  for (const byte of input) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(input: string): Buffer {
  let bits = 0; let value = 0; const out: number[] = [];
  for (const ch of input.replace(/=+$/,'').toUpperCase()) { const index = ALPHABET.indexOf(ch); if (index < 0) throw new Error('Invalid TOTP secret'); value = (value << 5) | index; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function code(secret: string, counter: number): string {
  const key = base32Decode(secret); const data = Buffer.alloc(8); data.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(data).digest(); const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset+1] & 255) << 16) | ((digest[offset+2] & 255) << 8) | (digest[offset+3] & 255);
  return String(binary % 1_000_000).padStart(6,'0');
}
function verifyTotp(secret: string, otp: string): boolean {
  if (!/^\d{6}$/.test(otp)) return false; const current = Math.floor(Date.now()/1000/30);
  for (let delta=-1; delta<=1; delta += 1) if (code(secret, current+delta) === otp) return true;
  return false;
}

@Injectable()
export class MfaService {
  constructor(private readonly repository: MfaRepository) {}
  async status(userId: string) { const record = await this.repository.get(userId); return { enabled: Boolean(record?.enabledAt) }; }
  async setup(userId: string, issuer = 'InvestIQ') {
    const secret = base32Encode(randomBytes(20));
    await this.repository.saveSecret(userId, encryptField(secret));
    const label = `${issuer}:${userId}`;
    const otpauthUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return { secret, otpauth_uri: otpauthUri, message: 'Scan the QR/provisioning URI in an authenticator app, then verify the first code to enable MFA.' };
  }
  async enable(userId: string, otp: string) {
    const record = await this.repository.get(userId); if (!record) throw new BadRequestException('MFA setup has not been started');
    if (!verifyTotp(decryptField(record.secretCiphertext), otp)) throw new UnauthorizedException('Invalid MFA code');
    await this.repository.enable(userId); return { enabled:true };
  }
  async disable(userId: string, otp: string) {
    const record = await this.repository.get(userId); if (!record?.enabledAt) return { enabled:false };
    if (!verifyTotp(decryptField(record.secretCiphertext), otp)) throw new UnauthorizedException('Invalid MFA code');
    await this.repository.disable(userId); return { enabled:false };
  }
  async verifyForTransaction(userId: string, otp: string): Promise<boolean> {
    const record = await this.repository.get(userId);
    if (!record?.enabledAt) return false;
    return verifyTotp(decryptField(record.secretCiphertext), otp);
  }
  async challenge(userId: string): Promise<string> {
    const raw = `${randomUUID()}-${randomBytes(32).toString('base64url')}`; const hash = hashOpaque(raw);
    await this.repository.createChallenge(randomUUID(), userId, hash, new Date(Date.now()+5*60_000).toISOString()); return raw;
  }
  async verifyChallenge(challenge: string, otp: string): Promise<string> {
    const row = await this.repository.consumeChallenge(hashOpaque(challenge)); if (!row) throw new UnauthorizedException('MFA challenge is invalid or expired');
    const record = await this.repository.get(row.userId); if (!record?.enabledAt || !verifyTotp(decryptField(record.secretCiphertext), otp)) throw new UnauthorizedException('Invalid MFA code');
    return row.userId;
  }
}
