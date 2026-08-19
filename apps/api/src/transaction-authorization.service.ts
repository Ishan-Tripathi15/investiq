import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OrderRequest } from '@investiq/domain';
import { validateOrder } from '@investiq/domain';
import { MfaService } from './mfa.service';
import { TransactionAuthorizationRepository } from './transaction-authorization.repository';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

function payloadHash(request: OrderRequest): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(request))).digest('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TransactionAuthorizationService {
  constructor(
    private readonly repository: TransactionAuthorizationRepository,
    private readonly mfa: MfaService,
  ) {}

  async createChallenge(userId: string, request: OrderRequest) {
    const errors = validateOrder(request);
    if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60_000).toISOString();
    const hash = payloadHash(request);
    const mfaStatus = await this.mfa.status(userId);
    if (!mfaStatus.enabled) {
      throw new BadRequestException('MFA must be enabled before authorizing a live trading transaction');
    }
    await this.repository.createChallenge(id, userId, hash, expiresAt);
    return {
      challenge_id: id,
      expires_at: expiresAt,
      authorization: 'mfa_required',
      payload_hash: hash,
      message: 'Review the order details shown by the client before entering your MFA code. This authorization is valid only for this exact order payload and expires in 2 minutes.',
    };
  }

  async verifyChallenge(userId: string, challengeId: string, otp: string) {
    if (!/^[0-9]{6}$/.test(otp)) throw new BadRequestException('MFA code must be 6 digits');
    const challenge = await this.repository.getChallenge(challengeId, userId);
    if (!challenge) throw new UnauthorizedException('Transaction authorization challenge is invalid, expired, consumed, or locked');
    const valid = await this.mfa.verifyForTransaction(userId, otp);
    if (!valid) {
      await this.repository.recordFailedAttempt(challengeId, userId);
      throw new UnauthorizedException('Invalid MFA code');
    }
    if (!(await this.repository.consumeChallenge(challengeId, userId))) {
      throw new UnauthorizedException('Transaction authorization challenge could not be consumed');
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 90_000).toISOString();
    await this.repository.createAuthorization(randomUUID(), userId, hashToken(token), challenge.payloadHash, expiresAt);
    return { transaction_authorization: token, expires_at: expiresAt, payload_hash: challenge.payloadHash };
  }

  async consume(userId: string, token: string | undefined, request: OrderRequest): Promise<void> {
    if (!token?.trim()) throw new UnauthorizedException('Transaction authorization is required');
    const ok = await this.repository.consumeAuthorization(userId, hashToken(token.trim()), payloadHash(request));
    if (!ok) throw new UnauthorizedException('Transaction authorization is invalid, expired, already used, or does not match this order');
  }
}
