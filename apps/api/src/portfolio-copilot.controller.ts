import { BadRequestException, Body, Controller, Delete, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';

interface CopilotBody { question?: unknown; }

@Controller('portfolio')
export class PortfolioCopilotController {
  constructor(private readonly intelligence: PortfolioIntelligenceService) {}

  private validateQuestion(body: CopilotBody): string {
    if (typeof body.question !== 'string' || !body.question.trim()) {
      throw new BadRequestException('question must be a non-empty string');
    }
    if (body.question.length > 1000) throw new BadRequestException('question must be 1000 characters or fewer');
    return body.question;
  }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Post('copilot/context')
  context(@Req() req: AuthenticatedRequest, @Body() body: CopilotBody) {
    return this.intelligence.copilot(req.user!.id, this.validateQuestion(body));
  }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Post('copilot')
  answer(@Req() req: AuthenticatedRequest, @Body() body: CopilotBody) {
    return this.intelligence.copilotAnswer(req.user!.id, this.validateQuestion(body));
  }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('copilot/memory')
  memory(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    const parsed = limit === undefined ? 10 : Number(limit);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) throw new BadRequestException('limit must be between 1 and 10');
    return this.intelligence.copilotMemory(req.user!.id, parsed);
  }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Delete('copilot/memory')
  clearMemory(@Req() req: AuthenticatedRequest) {
    return this.intelligence.clearCopilotMemory(req.user!.id);
  }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('copilot/health')
  health() {
    return this.intelligence.copilotHealth();
  }
}
