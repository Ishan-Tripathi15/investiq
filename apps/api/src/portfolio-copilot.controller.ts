import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
  @Get('copilot/health')
  health() {
    return this.intelligence.copilotHealth();
  }
}
