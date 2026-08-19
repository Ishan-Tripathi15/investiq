import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AuthRole, AuthUser, TradingPermission } from './auth.types';
import { issueToken, verifyToken } from './auth.jwt';
import { AuthRepository, type AuthSession } from './auth.repository';
import { MfaService } from './mfa.service';
import { SecurityActivityService } from './security-activity.service';

interface ConfigUser { id: string; username: string; passwordHash: string; role: AuthRole; permissions: TradingPermission[]; }
export interface LoginSessionMetadata { deviceId?: string; deviceLabel?: string; ipAddress?: string; userAgent?: string; }

function hashRefresh(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function hashDeviceId(deviceId: string): string { return createHash('sha256').update(deviceId).digest('hex'); }
function verifyPassword(password: string, encoded: string): boolean {
  const [kind, salt, expected] = encoded.split('$');
  if (kind !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex'); const a=Buffer.from(actual,'hex'); const b=Buffer.from(expected,'hex');
  return a.length===b.length && timingSafeEqual(a,b);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly sessions: AuthRepository,
    private readonly mfa: MfaService,
    private readonly security: SecurityActivityService,
  ) {}
  private users(): ConfigUser[] {
    const raw=process.env.AUTH_USERS_JSON?.trim(); if(!raw) throw new ServiceUnavailableException('Authentication users are not configured');
    try { const users=JSON.parse(raw) as ConfigUser[]; if(!Array.isArray(users)) throw new Error(); return users; } catch { throw new ServiceUnavailableException('AUTH_USERS_JSON is invalid'); }
  }
  private publicUser(user:ConfigUser, sessionId?: string):AuthUser{return {id:user.id,role:user.role,permissions:user.permissions,...(sessionId ? { sessionId } : {})};}
  private normalizeMetadata(metadata: LoginSessionMetadata = {}): LoginSessionMetadata {
    return {
      deviceId: typeof metadata.deviceId === 'string' && metadata.deviceId.length <= 256 ? metadata.deviceId : undefined,
      deviceLabel: typeof metadata.deviceLabel === 'string' && metadata.deviceLabel.trim().length <= 80 ? metadata.deviceLabel.trim() : undefined,
      ipAddress: typeof metadata.ipAddress === 'string' && metadata.ipAddress.length <= 64 ? metadata.ipAddress : undefined,
      userAgent: typeof metadata.userAgent === 'string' && metadata.userAgent.length <= 512 ? metadata.userAgent : undefined,
    };
  }
  private async issueSession(user:ConfigUser, metadata: LoginSessionMetadata = {}){
    const sessionId=randomUUID(); const publicUser=this.publicUser(user, sessionId); const refresh=issueToken(publicUser,'refresh',sessionId); const exp=verifyToken(refresh,'refresh').exp;
    const normalized=this.normalizeMetadata(metadata);
    await this.sessions.create({id:sessionId,userId:user.id,expiresAt:new Date(exp*1000).toISOString(),revoked:false,deviceIdHash:normalized.deviceId ? hashDeviceId(normalized.deviceId) : undefined,deviceLabel:normalized.deviceLabel,ipAddress:normalized.ipAddress,userAgent:normalized.userAgent},hashRefresh(refresh));
    await this.security.record(user.id, 'auth.session_created', { method: 'password_mfa_or_password', device_label: normalized.deviceLabel ?? undefined });
    return { access_token:issueToken(publicUser,'access',sessionId),refresh_token:refresh,token_type:'Bearer',expires_in:Number(process.env.AUTH_ACCESS_TTL_SECONDS??900),user:publicUser };
  }
  async login(username:string,password:string,metadata: LoginSessionMetadata = {}){
    const user=this.users().find(x=>x.username===username);
    if(!user||!verifyPassword(password,user.passwordHash)) {
      if (user) await this.security.record(user.id, 'auth.login_failed', { reason: 'invalid_credentials' });
      throw new UnauthorizedException('Invalid credentials');
    }
    const mfaStatus=await this.mfa.status(user.id);
    if(mfaStatus.enabled) {
      await this.security.record(user.id, 'auth.mfa_challenge_issued', {});
      return {mfa_required:true,challenge_token:await this.mfa.challenge(user.id),expires_in:300};
    }
    await this.security.record(user.id, 'auth.login_succeeded', { mfa: false });
    return this.issueSession(user, metadata);
  }
  async verifyMfa(challenge:string,otp:string,metadata: LoginSessionMetadata = {}){
    const userId=await this.mfa.verifyChallenge(challenge,otp); const user=this.users().find(x=>x.id===userId); if(!user) throw new UnauthorizedException('User is no longer active');
    await this.security.record(user.id, 'auth.login_succeeded', { mfa: true });
    return this.issueSession(user, metadata);
  }
  async refresh(refreshToken:string){
    let claims; try{claims=verifyToken(refreshToken,'refresh');}catch{throw new UnauthorizedException('Invalid refresh token');}
    if(!claims.sid)throw new UnauthorizedException('Refresh session is invalid'); const oldHash=hashRefresh(refreshToken); const session=await this.sessions.findActive(claims.sid,oldHash);
    if(!session||session.userId!==claims.sub)throw new UnauthorizedException('Refresh session is invalid or expired'); const user=this.users().find(x=>x.id===claims.sub); if(!user)throw new UnauthorizedException('User is no longer active');
    const publicUser=this.publicUser(user, claims.sid); const next=issueToken(publicUser,'refresh',claims.sid); const nextExp=verifyToken(next,'refresh').exp;
    if(!(await this.sessions.rotate(claims.sid,oldHash,hashRefresh(next),new Date(nextExp*1000).toISOString())))throw new UnauthorizedException('Refresh token rotation failed');
    await this.security.record(user.id, 'auth.refresh_rotated', {});
    return {access_token:issueToken(publicUser,'access',claims.sid),refresh_token:next,token_type:'Bearer',expires_in:Number(process.env.AUTH_ACCESS_TTL_SECONDS??900),user:publicUser};
  }
  async logout(refreshToken:string){
    try{const claims=verifyToken(refreshToken,'refresh');if(claims.sid){const session=await this.sessions.findActive(claims.sid,hashRefresh(refreshToken));await this.sessions.revoke(claims.sid,hashRefresh(refreshToken));if(session)await this.security.record(session.userId,'auth.logout',{session_id:claims.sid});}}catch{/* intentionally idempotent */}
    return {success:true};
  }
  async listSessions(userId: string): Promise<Array<Omit<AuthSession, 'deviceIdHash' | 'revoked'>>> {
    const sessions = await this.sessions.listActive(userId);
    return sessions.map(({ deviceIdHash: _deviceIdHash, revoked: _revoked, ...session }) => session);
  }
  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean }> {
    if (!sessionId || sessionId.length > 128) throw new UnauthorizedException('Invalid session');
    const success = await this.sessions.revokeSession(userId, sessionId);
    if (success) await this.security.record(userId, 'auth.session_revoked', { session_id: sessionId });
    return { success };
  }
  async revokeOtherSessions(userId: string, currentSessionId?: string): Promise<{ revoked: number }> {
    if (!currentSessionId) throw new UnauthorizedException('Current session is unavailable');
    const revoked = await this.sessions.revokeOthers(userId, currentSessionId);
    await this.security.record(userId, 'auth.other_sessions_revoked', { revoked });
    return { revoked };
  }
  verifyAccess(token:string):AuthUser{const claims=verifyToken(token,'access');return {id:claims.sub,role:claims.role,permissions:claims.permissions,sessionId:claims.sid};}
}
