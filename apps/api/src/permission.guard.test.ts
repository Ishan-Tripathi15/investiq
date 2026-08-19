import { describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import type { AuthenticatedRequest } from './auth.types';

function context(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('allows a user with the required permission', () => {
    const guard = new (PermissionGuard('orders:create'))();
    const request: AuthenticatedRequest = { user: { id: 'u1', role: 'user', permissions: ['orders:create'] } };
    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('rejects a user without the required permission', () => {
    const guard = new (PermissionGuard('orders:cancel'))();
    const request: AuthenticatedRequest = { user: { id: 'u1', role: 'user', permissions: ['orders:create'] } };
    expect(() => guard.canActivate(context(request))).toThrow(ForbiddenException);
  });

  it('allows an authenticated admin', () => {
    const guard = new (PermissionGuard('orders:cancel'))();
    const request: AuthenticatedRequest = { user: { id: 'admin', role: 'admin', permissions: [] } };
    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('fails closed when user context is missing', () => {
    const guard = new (PermissionGuard('portfolio:read'))();
    expect(() => guard.canActivate(context({}))).toThrow(ForbiddenException);
  });
});
