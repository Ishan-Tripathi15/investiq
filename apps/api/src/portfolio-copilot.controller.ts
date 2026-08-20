import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';

interface CopilotBody { question?: unknown; }

@Controller('portfolio')
export class PortfolioCopilotController {
  constructor(private readonly intelligence: PortfolioIntelligenceService) {}

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Post('copilot/context')
  context(@Req() req: AuthenticatedRequest, @Body() body: CopilotBody) {
    if (typeof body.question !== 'string' || !body.question.trim()) {
      throw new BadRequestException('question must be a non-empty string');
    }
    return this.intelligence.copilot(req.user!.id, body.question);
  }
}
