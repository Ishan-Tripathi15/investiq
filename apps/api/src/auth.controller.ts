import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';
import type { AuthenticatedRequest } from './auth.types';

interface LoginBody { username?: unknown; password?: unknown; device_id?: unknown; device_label?: unknown; }
interface RefreshBody { refresh_token?: unknown; }
interface MfaBody { challenge_token?: unknown; code?: unknown; device_id?: unknown; device_label?: unknown; }
function requiredString(value:unknown,field:string):string{if(typeof value!=='string'||value.length===0||value.length>512)throw new BadRequestException(`${field} must be a non-empty string`);return value;}
function optionalString(value:unknown,field:string,max=256):string|undefined{if(value===undefined||value===null)return undefined;if(typeof value!=='string'||value.length>max)throw new BadRequestException(`${field} is invalid`);return value;}
function metadata(req: Request, body: { device_id?: unknown; device_label?: unknown }) {
  return {
    deviceId: optionalString(body.device_id,'device_id',256),
    deviceLabel: optionalString(body.device_label,'device_label',80),
    ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0,512) : undefined,
  };
}

@Controller('auth')
export class AuthController{
 constructor(private readonly auth:AuthService){}
 @Post('login') @HttpCode(HttpStatus.OK) login(@Req() req: Request, @Body() body:LoginBody){return this.auth.login(requiredString(body.username,'username'),requiredString(body.password,'password'),metadata(req,body));}
 @Post('mfa/verify') @HttpCode(HttpStatus.OK) verifyMfa(@Req() req: Request, @Body() body:MfaBody){return this.auth.verifyMfa(requiredString(body.challenge_token,'challenge_token'),requiredString(body.code,'code'),metadata(req,body));}
 @Post('refresh') @HttpCode(HttpStatus.OK) refresh(@Body() body:RefreshBody){return this.auth.refresh(requiredString(body.refresh_token,'refresh_token'));}
 @Post('logout') @HttpCode(HttpStatus.OK) logout(@Body() body:RefreshBody){return this.auth.logout(typeof body.refresh_token==='string'?body.refresh_token:'');}
 @UseGuards(AuthGuard, PermissionGuard('account:read'))
 @Get('sessions') sessions(@Req() req:AuthenticatedRequest){return this.auth.listSessions(req.user!.id);}
 @UseGuards(AuthGuard, PermissionGuard('account:read'))
 @Post('sessions/:id/revoke') revokeSession(@Req() req:AuthenticatedRequest,@Param('id') id:string){return this.auth.revokeSession(req.user!.id,id);}
 @UseGuards(AuthGuard, PermissionGuard('account:read'))
 @Post('sessions/revoke-others') revokeOthers(@Req() req:AuthenticatedRequest){return this.auth.revokeOtherSessions(req.user!.id,req.user!.sessionId);}
}
