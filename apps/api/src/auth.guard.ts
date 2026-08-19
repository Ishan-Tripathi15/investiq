import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest, AuthUser } from './auth.types';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    try { request.user = this.auth.verifyAccess(token); return true; }
    catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
  static attachVerifiedUser(request: AuthenticatedRequest, user: AuthUser): void { request.user = user; }
}
