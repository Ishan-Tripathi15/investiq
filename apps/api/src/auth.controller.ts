import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') @HttpCode(HttpStatus.OK)
  login(@Body() body: { username?: string; password?: string }) {
    if (!body.username || !body.password) return this.auth.login('', '');
    return this.auth.login(body.username, body.password);
  }
  @Post('refresh') @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refresh_token?: string }) {
    if (!body.refresh_token) return this.auth.refresh('');
    return this.auth.refresh(body.refresh_token);
  }
  @Post('logout') @HttpCode(HttpStatus.OK)
  logout(@Body() body: { refresh_token?: string }) { return this.auth.logout(body.refresh_token ?? ''); }
}
