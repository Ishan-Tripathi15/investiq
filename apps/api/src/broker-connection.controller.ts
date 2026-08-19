import { BadRequestException, Controller, Delete, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { BrokerConnectionService } from './broker-connection.service';
import { PermissionGuard } from './permission.guard';

@Controller('trading/broker')
export class BrokerConnectionController {
  constructor(private readonly connections: BrokerConnectionService) {}

  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Get('zerodha/connect')
  connect(@Req() req: AuthenticatedRequest) {
    return this.connections.connectUrl(req.user!.id);
  }

  @Get('zerodha/callback')
  callback(@Query('request_token') requestToken?: string, @Query('state') state?: string) {
    if (!requestToken || !state) throw new BadRequestException('request_token and state are required');
    return this.connections.callback(requestToken, state);
  }

  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Get('connection')
  status(@Req() req: AuthenticatedRequest) {
    return this.connections.status(req.user!.id);
  }

  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Delete('connection')
  disconnect(@Req() req: AuthenticatedRequest) {
    return this.connections.disconnect(req.user!.id);
  }
}
