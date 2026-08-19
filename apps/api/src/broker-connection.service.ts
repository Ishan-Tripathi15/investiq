import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { BrokerConnectionRepository } from './broker-connection.repository';
import { encryptBrokerToken, hashBrokerOAuthState } from './broker-crypto';

const PROVIDER = 'zerodha';
const KITE_API_ROOT = 'https://api.kite.trade';
const KITE_LOGIN_ROOT = 'https://kite.zerodha.com/connect/login';

interface KiteSessionResponse {
  status?: string;
  message?: string;
  data?: {
    user_id?: string;
    broker?: string;
    access_token?: string;
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ServiceUnavailableException(`${name} is not configured`);
  return value;
}

@Injectable()
export class BrokerConnectionService {
  constructor(private readonly repository: BrokerConnectionRepository) {}

  async connectUrl(userId: string) {
    const apiKey = requiredEnv('KITE_API_KEY');
    const redirectUrl = requiredEnv('KITE_REDIRECT_URL');
    const state = randomBytes(32).toString('base64url');
    await this.repository.createOAuthState(
      hashBrokerOAuthState(state),
      userId,
      PROVIDER,
      new Date(Date.now() + 10 * 60_000),
    );

    const url = new URL(KITE_LOGIN_ROOT);
    url.searchParams.set('v', '3');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('redirect_params', `state=${encodeURIComponent(state)}`);
    return { provider: PROVIDER, loginUrl: url.toString(), redirectUrl };
  }

  async callback(requestToken: string, state: string) {
    if (!requestToken.trim() || !state.trim()) throw new BadRequestException('request_token and state are required');
    const userId = await this.repository.consumeOAuthState(hashBrokerOAuthState(state), PROVIDER);
    if (!userId) throw new BadRequestException('Invalid, expired, or already-used broker connection state');

    const apiKey = requiredEnv('KITE_API_KEY');
    const apiSecret = requiredEnv('KITE_API_SECRET');
    const checksum = createHash('sha256').update(apiKey + requestToken + apiSecret, 'utf8').digest('hex');
    const body = new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum });

    const response = await fetch(`${KITE_API_ROOT}/session/token`, {
      method: 'POST',
      headers: { 'X-Kite-Version': '3', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new ServiceUnavailableException(`Broker session exchange failed with HTTP ${response.status}`);

    const payload = await response.json() as KiteSessionResponse;
    const accessToken = payload.data?.access_token;
    const brokerUserId = payload.data?.user_id;
    if (payload.status !== 'success' || !accessToken || !brokerUserId) {
      throw new ServiceUnavailableException(payload.message ?? 'Broker session exchange returned an invalid response');
    }

    await this.repository.upsertConnection(userId, PROVIDER, brokerUserId, encryptBrokerToken(accessToken));
    return { connected: true, provider: PROVIDER, brokerUserId };
  }

  async status(userId: string) {
    const connection = await this.repository.getConnection(userId, PROVIDER);
    return connection
      ? { connected: true, provider: PROVIDER, brokerUserId: connection.brokerUserId, connectedAt: connection.connectedAt, updatedAt: connection.updatedAt }
      : { connected: false, provider: PROVIDER };
  }

  async disconnect(userId: string) {
    await this.repository.disconnect(userId, PROVIDER);
    return { disconnected: true, provider: PROVIDER };
  }
}
