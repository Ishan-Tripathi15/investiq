import { BadRequestException, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Get('status') status() { return this.ai.status(); }
  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('knowledge') knowledge(@Query('q') query?: string, @Query('limit') limit?: string) { if (!query?.trim()) throw new BadRequestException('q query parameter is required'); return this.ai.knowledge(query, Number(limit ?? 5)); }
  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('risk-twin') riskTwin(@Req() req: AuthenticatedRequest) { return this.ai.riskTwin(req.user!.id); }
  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Post('analysis/:symbol') analyze(@Param('symbol') symbol: string) { return this.ai.analyzeSymbol(symbol); }
}
