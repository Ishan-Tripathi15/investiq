import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest, AuthUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    // Production identity verification is intentionally isolated here.
    // Until a real identity provider/JWT verifier is configured, never trust
    // client-supplied identity claims and never create an authenticated user.
    throw new UnauthorizedException('Authentication provider is not configured');
  }

  static attachVerifiedUser(request: AuthenticatedRequest, user: AuthUser): void {
    request.user = user;
  }
}
