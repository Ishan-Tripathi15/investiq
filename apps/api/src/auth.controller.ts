import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
interface LoginBody { username?: unknown; password?: unknown; }
interface RefreshBody { refresh_token?: unknown; }
interface MfaBody { challenge_token?: unknown; code?: unknown; }
function requiredString(value:unknown,field:string):string{if(typeof value!=='string'||value.length===0||value.length>512)throw new BadRequestException(`${field} must be a non-empty string`);return value;}
@Controller('auth')
export class AuthController{
 constructor(private readonly auth:AuthService){}
 @Post('login') @HttpCode(HttpStatus.OK) login(@Body() body:LoginBody){return this.auth.login(requiredString(body.username,'username'),requiredString(body.password,'password'));}
 @Post('mfa/verify') @HttpCode(HttpStatus.OK) verifyMfa(@Body() body:MfaBody){return this.auth.verifyMfa(requiredString(body.challenge_token,'challenge_token'),requiredString(body.code,'code'));}
 @Post('refresh') @HttpCode(HttpStatus.OK) refresh(@Body() body:RefreshBody){return this.auth.refresh(requiredString(body.refresh_token,'refresh_token'));}
 @Post('logout') @HttpCode(HttpStatus.OK) logout(@Body() body:RefreshBody){return this.auth.logout(typeof body.refresh_token==='string'?body.refresh_token:'');}
}
