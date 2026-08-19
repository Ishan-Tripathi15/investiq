import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AuthRole, AuthUser, TradingPermission } from './auth.types';
import { issueToken, verifyToken } from './auth.jwt';
import { AuthRepository } from './auth.repository';
import { MfaService } from './mfa.service';

interface ConfigUser { id: string; username: string; passwordHash: string; role: AuthRole; permissions: TradingPermission[]; }
function hashRefresh(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function verifyPassword(password: string, encoded: string): boolean {
  const [kind, salt, expected] = encoded.split('$');
  if (kind !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex'); const a=Buffer.from(actual,'hex'); const b=Buffer.from(expected,'hex');
  return a.length===b.length && timingSafeEqual(a,b);
}

@Injectable()
export class AuthService {
  constructor(private readonly sessions: AuthRepository, private readonly mfa: MfaService) {}
  private users(): ConfigUser[] {
    const raw=process.env.AUTH_USERS_JSON?.trim(); if(!raw) throw new ServiceUnavailableException('Authentication users are not configured');
    try { const users=JSON.parse(raw) as ConfigUser[]; if(!Array.isArray(users)) throw new Error(); return users; } catch { throw new ServiceUnavailableException('AUTH_USERS_JSON is invalid'); }
  }
  private publicUser(user:ConfigUser):AuthUser{return {id:user.id,role:user.role,permissions:user.permissions};}
  private async issueSession(user:ConfigUser){
    const sessionId=randomUUID(); const refresh=issueToken(this.publicUser(user),'refresh',sessionId); const exp=verifyToken(refresh,'refresh').exp;
    await this.sessions.create({id:sessionId,userId:user.id,expiresAt:new Date(exp*1000).toISOString(),revoked:false},hashRefresh(refresh));
    return {access_token:issueToken(this.publicUser(user),'access'),refresh_token:refresh,token_type:'Bearer',expires_in:Number(process.env.AUTH_ACCESS_TTL_SECONDS??900),user:this.publicUser(user)};
  }
  async login(username:string,password:string){
    const user=this.users().find(x=>x.username===username); if(!user||!verifyPassword(password,user.passwordHash)) throw new UnauthorizedException('Invalid credentials');
    const mfaStatus=await this.mfa.status(user.id);
    if(mfaStatus.enabled) return {mfa_required:true,challenge_token:await this.mfa.challenge(user.id),expires_in:300};
    return this.issueSession(user);
  }
  async verifyMfa(challenge:string,otp:string){
    const userId=await this.mfa.verifyChallenge(challenge,otp); const user=this.users().find(x=>x.id===userId); if(!user) throw new UnauthorizedException('User is no longer active');
    return this.issueSession(user);
  }
  async refresh(refreshToken:string){
    let claims; try{claims=verifyToken(refreshToken,'refresh');}catch{throw new UnauthorizedException('Invalid refresh token');}
    if(!claims.sid)throw new UnauthorizedException('Refresh session is invalid'); const oldHash=hashRefresh(refreshToken); const session=await this.sessions.findActive(claims.sid,oldHash);
    if(!session||session.userId!==claims.sub)throw new UnauthorizedException('Refresh session is invalid or expired'); const user=this.users().find(x=>x.id===claims.sub); if(!user)throw new UnauthorizedException('User is no longer active');
    const next=issueToken(this.publicUser(user),'refresh',claims.sid); const nextExp=verifyToken(next,'refresh').exp;
    if(!(await this.sessions.rotate(claims.sid,oldHash,hashRefresh(next),new Date(nextExp*1000).toISOString())))throw new UnauthorizedException('Refresh token rotation failed');
    return {access_token:issueToken(this.publicUser(user),'access'),refresh_token:next,token_type:'Bearer',expires_in:Number(process.env.AUTH_ACCESS_TTL_SECONDS??900),user:this.publicUser(user)};
  }
  async logout(refreshToken:string){try{const claims=verifyToken(refreshToken,'refresh');if(claims.sid)await this.sessions.revoke(claims.sid,hashRefresh(refreshToken));}catch{/* intentionally idempotent */}return {success:true};}
  verifyAccess(token:string):AuthUser{const claims=verifyToken(token,'access');return {id:claims.sub,role:claims.role,permissions:claims.permissions};}
}
