import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { MutualFundWatchlistService } from './mutual-fund-watchlist.service';

@Controller('mutual-fund-watchlist')
@UseGuards(AuthGuard)
export class MutualFundWatchlistController {
  constructor(private readonly service: MutualFundWatchlistService) {}
  @Get() list(@Req() request: Request & AuthenticatedRequest) { return this.service.list(request.user!.id); }
  @Post() add(@Req() request: Request & AuthenticatedRequest, @Body() body: { schemeCode?: string }) { return this.service.add(request.user!.id, body.schemeCode ?? ''); }
  @Delete(':schemeCode') remove(@Req() request: Request & AuthenticatedRequest, @Param('schemeCode') schemeCode: string) { return this.service.remove(request.user!.id, schemeCode); }
}
