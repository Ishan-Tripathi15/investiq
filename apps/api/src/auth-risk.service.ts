import { Injectable } from '@nestjs/common';
import { evaluateAuthRisk, type AuthRiskResult } from '@investiq/domain';
import { createHash } from 'node:crypto';
import { AuthRepository } from './auth.repository';
import { MfaService } from './mfa.service';

function hashDeviceId(deviceId?: string): string | undefined {
  return deviceId ? createHash('sha256').update(deviceId).digest('hex') : undefined;
}

export interface LoginRiskContext {
  userId: string;
  deviceId?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthRiskService {
  constructor(private readonly sessions: AuthRepository, private readonly mfa: MfaService) {}

  async assessLogin(context: LoginRiskContext): Promise<AuthRiskResult> {
    const active = await this.sessions.listActive(context.userId);
    // A first-ever login has no prior context to compare against.
    if (active.length === 0) {
      return evaluateAuthRisk({ hasKnownDevice: true, hasKnownIp: true, hasMfa: await this.mfa.status(context.userId).then((x) => x.enabled), failedAttempts: 0 });
    }

    const deviceHash = hashDeviceId(context.deviceId);
    const hasKnownDevice = Boolean(deviceHash && active.some((session) => session.deviceIdHash === deviceHash));
    const hasKnownIp = Boolean(context.ipAddress && active.some((session) => session.ipAddress === context.ipAddress));
    const mfaEnabled = (await this.mfa.status(context.userId)).enabled;
    return evaluateAuthRisk({ hasKnownDevice, hasKnownIp, hasMfa: mfaEnabled, failedAttempts: 0 });
  }
}
