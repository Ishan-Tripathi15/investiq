import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthRole, AuthUser, TradingPermission } from './auth.types';

type TokenKind = 'access' | 'refresh';
interface Claims { sub: string; role: AuthRole; permissions: TradingPermission[]; sid?: string; typ: TokenKind; iat: number; exp: number; iss: string; aud: string; }

function b64url(value: string | Buffer): string { return Buffer.from(value).toString('base64url'); }
function decode(value: string): string { return Buffer.from(value, 'base64url').toString('utf8'); }
function sign(input: string, secret: string): string { return createHmac('sha256', secret).update(input).digest('base64url'); }

export function jwtConfig() {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('AUTH_JWT_SECRET must be configured with at least 32 characters');
  const issuer = process.env.AUTH_JWT_ISSUER?.trim() || 'investiq-api';
  const audience = process.env.AUTH_JWT_AUDIENCE?.trim() || 'investiq-mobile';
  return { secret, issuer, audience };
}

function ttl(kind: TokenKind): number {
  const value = Number(process.env[kind === 'access' ? 'AUTH_ACCESS_TTL_SECONDS' : 'AUTH_REFRESH_TTL_SECONDS'] ?? (kind === 'access' ? 900 : 2592000));
  if (!Number.isInteger(value) || value <= 0 || value > 31536000) throw new Error('Authentication token TTL is invalid');
  return value;
}

export function issueToken(user: AuthUser, kind: TokenKind, sessionId?: string): string {
  const config = jwtConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: Claims = { sub: user.id, role: user.role, permissions: user.permissions, ...(sessionId ? { sid: sessionId } : {}), typ: kind, iat: now, exp: now + ttl(kind), iss: config.issuer, aud: config.audience };
  const body = `${header}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body, config.secret)}`;
}

export function verifyToken(token: string, expectedKind: TokenKind): Claims {
  const config = jwtConfig();
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  let header: { alg?: unknown; typ?: unknown };
  let payload: Claims;
  try {
    header = JSON.parse(decode(parts[0])) as { alg?: unknown; typ?: unknown };
    payload = JSON.parse(decode(parts[1])) as Claims;
  } catch { throw new Error('Malformed token'); }
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Unsupported token algorithm');

  const expected = sign(`${parts[0]}.${parts[1]}`, config.secret);
  const provided = parts[2];
  const a = Buffer.from(expected); const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid token signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.typ !== expectedKind || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= now || payload.iat > now + 30 || payload.exp <= payload.iat || payload.iss !== config.issuer || payload.aud !== config.audience || typeof payload.sub !== 'string' || !payload.sub) throw new Error('Invalid or expired token');
  if (payload.role !== 'user' && payload.role !== 'admin') throw new Error('Invalid token role');
  if (!Array.isArray(payload.permissions) || payload.permissions.some((permission) => typeof permission !== 'string')) throw new Error('Invalid token permissions');
  if (expectedKind === 'refresh' && (typeof payload.sid !== 'string' || !payload.sid)) throw new Error('Refresh session is invalid');
  return payload;
}
