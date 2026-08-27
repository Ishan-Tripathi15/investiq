import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';
import { buildIntelligenceDigest, evaluateIntelligenceAlertTriggers } from '@investiq/domain';
import { SecurityNotificationsService } from './security-notifications.service';

@Controller('portfolio')
@UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
export class IntelligenceDigestController {
  constructor(private readonly intelligence: PortfolioIntelligenceService, private readonly notifications: SecurityNotificationsService) {}

  @Get('intelligence/notifications/sync')
  async syncNotifications(@Req() req: AuthenticatedRequest) {
    const result = await this.intelligence.actionCenter(req.user!.id);
    const triggers = evaluateIntelligenceAlertTriggers(result.actions);
    const created = [];
    for (const trigger of triggers.filter((item) => item.shouldNotify)) {
      const action = result.actions.find((item) => item.id === trigger.actionId);
      if (action) created.push(await this.notifications.createIntelligenceAction(req.user!.id, action));
    }
    return { generatedAt: new Date().toISOString(), considered: triggers.length, created: created.filter(Boolean).length };
  }

  @Get('intelligence/digest')
  async digest(@Req() req: AuthenticatedRequest) {
    const result = await this.intelligence.actionCenter(req.user!.id);
    return buildIntelligenceDigest({
      actions: result.actions,
      alerts: [],
    });
  }
}
