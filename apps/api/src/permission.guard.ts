import { CanActivate, ExecutionContext, ForbiddenException, Injectable, mixin, type Type } from '@nestjs/common';
import type { AuthenticatedRequest, TradingPermission } from './auth.types';

@Injectable()
class PermissionGuardBase implements CanActivate {
  constructor(private readonly requiredPermission: TradingPermission) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (user.role === 'admin' || user.permissions.includes(this.requiredPermission)) return true;
    throw new ForbiddenException(`Missing permission: ${this.requiredPermission}`);
  }
}

export function PermissionGuard(permission: TradingPermission): Type<CanActivate> {
  return mixin(class extends PermissionGuardBase {
    constructor() { super(permission); }
  });
}
