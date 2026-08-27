import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';
import { buildIntelligenceDigest } from '@investiq/domain';

@Controller('portfolio')
@UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
export class IntelligenceDigestController {
  constructor(private readonly intelligence: PortfolioIntelligenceService) {}

  @Get('intelligence/digest')
  async digest(@Req() req: AuthenticatedRequest) {
    const result = await this.intelligence.actionCenter(req.user!.id);
    return buildIntelligenceDigest({
      actions: result.actions,
      alerts: [],
    });
  }
}
