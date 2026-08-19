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
  return { secret, issuer: process.env.AUTH_JWT_ISSUER?.trim() || 'investiq-api', audience: process.env.AUTH_JWT_AUDIENCE?.trim() || 'investiq-mobile' };
}

export function issueToken(user: AuthUser, kind: TokenKind, sessionId?: string): string {
  const config = jwtConfig();
  const now = Math.floor(Date.now() / 1000);
  const ttl = kind === 'access' ? Number(process.env.AUTH_ACCESS_TTL_SECONDS ?? 900) : Number(process.env.AUTH_REFRESH_TTL_SECONDS ?? 2592000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: Claims = { sub: user.id, role: user.role, permissions: user.permissions, ...(sessionId ? { sid: sessionId } : {}), typ: kind, iat: now, exp: now + ttl, iss: config.issuer, aud: config.audience };
  const body = `${header}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body, config.secret)}`;
}

export function verifyToken(token: string, expectedKind: TokenKind): Claims {
  const config = jwtConfig();
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const expected = sign(`${parts[0]}.${parts[1]}`, config.secret);
  const provided = parts[2];
  const a = Buffer.from(expected); const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid token signature');
  const payload = JSON.parse(decode(parts[1])) as Claims;
  const now = Math.floor(Date.now() / 1000);
  if (payload.typ !== expectedKind || payload.exp <= now || payload.iss !== config.issuer || payload.aud !== config.audience || !payload.sub) throw new Error('Invalid or expired token');
  return payload;
}
