import { describe, expect, it, vi, afterEach } from 'vitest';
import { encryptBrokerToken } from './broker-crypto';
import { KiteBrokerAdapter } from './trading.provider';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.BROKER_PROVIDER;
  delete process.env.KITE_API_KEY;
  delete process.env.BROKER_TOKEN_ENCRYPTION_KEY;
});

describe('KiteBrokerAdapter', () => {
  it('exposes the safe initial NSE equity capability set', async () => {
    const adapter = new KiteBrokerAdapter({} as never);
    await expect(adapter.capabilities()).resolves.toMatchObject({
      broker: 'zerodha',
      exchange: 'NSE',
      currency: 'INR',
      supportedOrderTypes: ['market', 'limit', 'stop_loss', 'stop_limit'],
      supportedTimeInForce: ['day'],
      fractionalQuantity: false,
    });
  });

  it('maps a live order request to Kite regular-order parameters without exposing secrets', async () => {
    process.env.BROKER_PROVIDER = 'zerodha';
    process.env.KITE_API_KEY = 'test-api-key';
    process.env.BROKER_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const token = 'test-access-token';
    const connection = {
      getConnection: vi.fn().mockResolvedValue({ encryptedAccessToken: encryptBrokerToken(token) }),
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { order_id: 'KITE-123' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new KiteBrokerAdapter(connection as never);
    const order = await adapter.placeOrder('user-1', {
      symbol: 'reliance',
      side: 'buy',
      type: 'limit',
      quantity: 2,
      price: 1500,
      timeInForce: 'day',
    });

    expect(order.id).toBe('KITE-123');
    expect(order.status).toBe('submitted');
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get('X-Kite-Version')).toBe('3');
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    expect(headers.get('Authorization')).toBe(`token test-api-key:${token}`);
    expect(String(request.body)).toContain('tradingsymbol=RELIANCE');
    expect(String(request.body)).toContain('product=CNC');
    expect(String(request.body)).not.toContain(token);
  });
});
