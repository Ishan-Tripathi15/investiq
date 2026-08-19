import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createKycProvider } from './kyc.provider';
import type { KycHealth, KycStatusResult } from './kyc.types';
import { ProfileRepository } from './profile.repository';

@Injectable()
export class KycService {
  private readonly provider = createKycProvider();

  constructor(private readonly profiles: ProfileRepository) {}

  health(): Promise<KycHealth> {
    return this.provider.health();
  }

  async start(userId: string): Promise<KycStatusResult> {
    const health = await this.provider.health();
    if (!health.configured) throw new ServiceUnavailableException(health.message);

    const reference = `inv-${createHash('sha256').update(userId).digest('hex').slice(0, 24)}`;
    const result = await this.provider.startVerification({ userId, reference });
    if (!result.available) throw new ServiceUnavailableException(result.message);

    await this.profiles.setKyc(userId, result.status, result.provider, result.reference, undefined);
    return {
      available: result.available,
      status: result.status,
      provider: result.provider,
      ...(result.reference ? { reference: result.reference } : {}),
      message: result.message,
    };
  }

  async status(userId: string, reference: string): Promise<KycStatusResult> {
    const normalized = reference.trim();
    if (!normalized || normalized.length > 256) throw new ServiceUnavailableException('Invalid KYC reference');
    const result = await this.provider.getStatus(normalized);
    if (result.available) {
      await this.profiles.setKyc(userId, result.status, result.provider, normalized, result.status === 'verified' ? new Date().toISOString() : undefined);
    }
    return result;
  }
}
