import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';

@Controller('portfolio')
export class PortfolioIntelligenceController {
  constructor(private readonly intelligence: PortfolioIntelligenceService) {}

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('intelligence')
  intelligenceReport(@Req() req: AuthenticatedRequest) {
    return this.intelligence.analyze(req.user!.id);
  }
}
