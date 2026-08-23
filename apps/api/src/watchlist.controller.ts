import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
@UseGuards(AuthGuard)
export class WatchlistController {
  constructor(private readonly service: WatchlistService) {}
  @Get()
  list(@Req() request: Request & AuthenticatedRequest) { return this.service.list(request.user!.id); }
  @Post()
  add(@Req() request: Request & AuthenticatedRequest, @Body() body: { symbol?: string }) { return this.service.add(request.user!.id, body.symbol ?? ''); }
  @Delete(':symbol')
  remove(@Req() request: Request & AuthenticatedRequest, @Param('symbol') symbol: string) { return this.service.remove(request.user!.id, symbol); }
}
