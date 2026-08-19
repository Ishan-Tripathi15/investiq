import { afterEach, describe, expect, it } from 'vitest';
import { issueToken, verifyToken } from './auth.jwt';
import type { AuthUser } from './auth.types';

const user: AuthUser = {
  id: 'user-1',
  role: 'user',
  permissions: ['portfolio:read', 'orders:read'],
};

const env = {
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  AUTH_ACCESS_TTL_SECONDS: process.env.AUTH_ACCESS_TTL_SECONDS,
  AUTH_REFRESH_TTL_SECONDS: process.env.AUTH_REFRESH_TTL_SECONDS,
};

function configure(): void {
  process.env.AUTH_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  process.env.AUTH_JWT_ISSUER = 'investiq-test';
  process.env.AUTH_JWT_AUDIENCE = 'investiq-test-client';
  process.env.AUTH_ACCESS_TTL_SECONDS = '300';
  process.env.AUTH_REFRESH_TTL_SECONDS = '3600';
}

afterEach(() => {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('JWT security boundary', () => {
  it('round-trips a valid access token', () => {
    configure();
    const token = issueToken(user, 'access');
    const claims = verifyToken(token, 'access');
    expect(claims.sub).toBe(user.id);
    expect(claims.role).toBe(user.role);
    expect(claims.permissions).toEqual(user.permissions);
    expect(claims.iss).toBe('investiq-test');
    expect(claims.aud).toBe('investiq-test-client');
  });

  it('rejects a token with a modified payload', () => {
    configure();
    const token = issueToken(user, 'access');
    const [header, payload, signature] = token.split('.');
    const modified = Buffer.from(JSON.stringify({ sub: 'attacker', role: 'admin', permissions: ['orders:create'] })).toString('base64url');
    expect(() => verifyToken(`${header}.${modified}.${signature}`, 'access')).toThrow();
  });

  it('rejects an access token when refresh is expected', () => {
    configure();
    const token = issueToken(user, 'access');
    expect(() => verifyToken(token, 'refresh')).toThrow();
  });

  it('rejects tokens when the configured secret changes', () => {
    configure();
    const token = issueToken(user, 'access');
    process.env.AUTH_JWT_SECRET = 'another-test-secret-that-is-at-least-32-chars';
    expect(() => verifyToken(token, 'access')).toThrow();
  });
});
