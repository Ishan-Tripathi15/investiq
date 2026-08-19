import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest, TradingPermission } from './auth.types';

export const REQUIRED_PERMISSION = 'investiq:required-permission';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly permission: TradingPermission) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (user.role === 'admin' || user.permissions.includes(this.permission)) return true;
    throw new ForbiddenException('Insufficient trading permission');
  }
}
