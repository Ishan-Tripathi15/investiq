export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected' | 'manual_review' | 'unavailable';

export interface KycHealth {
  configured: boolean;
  provider: string;
  message: string;
}

export interface KycStartRequest {
  userId: string;
  reference: string;
}

export interface KycStartResult {
  available: boolean;
  status: KycStatus;
  provider: string;
  reference?: string;
  redirectUrl?: string;
  message: string;
}

export interface KycStatusResult {
  available: boolean;
  status: KycStatus;
  provider: string;
  reference?: string;
  message: string;
}

export interface KycProvider {
  health(): Promise<KycHealth>;
  startVerification(request: KycStartRequest): Promise<KycStartResult>;
  getStatus(reference: string): Promise<KycStatusResult>;
}
