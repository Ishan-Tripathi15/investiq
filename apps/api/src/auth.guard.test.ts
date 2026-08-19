import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';

function context(request: AuthenticatedRequest & { headers: Record<string, string | undefined> }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('attaches the verified user from a bearer token', () => {
    const user = { id: 'u1', role: 'user' as const, permissions: ['orders:read' as const] };
    const auth = { verifyAccess: vi.fn().mockReturnValue(user) };
    const guard = new AuthGuard(auth as never);
    const request = { headers: { authorization: 'Bearer valid-token' } } as AuthenticatedRequest & { headers: Record<string, string | undefined> };

    expect(guard.canActivate(context(request))).toBe(true);
    expect(request.user).toEqual(user);
    expect(auth.verifyAccess).toHaveBeenCalledWith('valid-token');
  });

  it('rejects requests without a bearer token', () => {
    const auth = { verifyAccess: vi.fn() };
    const guard = new AuthGuard(auth as never);
    const request = { headers: {} } as AuthenticatedRequest & { headers: Record<string, string | undefined> };
    expect(() => guard.canActivate(context(request))).toThrow(UnauthorizedException);
    expect(auth.verifyAccess).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired access tokens', () => {
    const auth = { verifyAccess: vi.fn().mockImplementation(() => { throw new Error('invalid'); }) };
    const guard = new AuthGuard(auth as never);
    const request = { headers: { authorization: 'Bearer expired-token' } } as AuthenticatedRequest & { headers: Record<string, string | undefined> };
    expect(() => guard.canActivate(context(request))).toThrow('Invalid or expired access token');
  });
});
