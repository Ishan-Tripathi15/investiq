import type { KycHealth, KycProvider, KycStartRequest, KycStartResult, KycStatusResult } from './kyc.types';

class UnconfiguredKycProvider implements KycProvider {
  async health(): Promise<KycHealth> {
    return { configured: false, provider: 'unconfigured', message: 'No production KYC provider is configured.' };
  }

  async startVerification(_request: KycStartRequest): Promise<KycStartResult> {
    return {
      available: false,
      status: 'unavailable',
      provider: 'unconfigured',
      message: 'KYC verification is unavailable until an authorized production KYC provider is configured.',
    };
  }

  async getStatus(_reference: string): Promise<KycStatusResult> {
    return {
      available: false,
      status: 'unavailable',
      provider: 'unconfigured',
      message: 'KYC status is unavailable until an authorized production KYC provider is configured.',
    };
  }
}

export function createKycProvider(): KycProvider {
  // Keep provider credentials and onboarding contracts outside source control.
  // A concrete provider can be added here only when its production contract and credentials are configured.
  return new UnconfiguredKycProvider();
}
