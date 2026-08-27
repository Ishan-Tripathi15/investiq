import { Injectable, Logger } from '@nestjs/common';
import { buildIntelligenceDigest, shouldSendIntelligenceDigest, type DigestSchedule } from '@investiq/domain';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';
import { SecurityNotificationsService } from './security-notifications.service';

@Injectable()
export class IntelligenceDigestWorker {
  private readonly logger = new Logger(IntelligenceDigestWorker.name);

  constructor(
    private readonly intelligence: PortfolioIntelligenceService,
    private readonly notifications: SecurityNotificationsService,
  ) {}

  async run(userId: string, schedule: DigestSchedule, lastSentAt?: string) {
    const now = new Date();
    const decision = shouldSendIntelligenceDigest({
      schedule,
      now: { dayOfWeek: now.getUTCDay(), hour: now.getUTCHours(), minute: now.getUTCMinutes() },
      lastSentAt,
    });
    if (!decision.shouldSend) return { sent: false, reason: decision.reason };

    const result = await this.intelligence.actionCenter(userId);
    const digest = buildIntelligenceDigest({ actions: result.actions, alerts: [] });
    if (digest.criticalCount === 0 && digest.highCount === 0) {
      return { sent: false, reason: 'No urgent intelligence in digest.', digest };
    }

    const notification = await this.notifications.createIntelligenceAction(userId, {
      id: `digest-${Date.now()}`,
      severity: digest.criticalCount ? 'critical' : 'high',
      title: digest.title,
      reason: digest.summary,
      action: 'Review your portfolio intelligence digest.',
      source: 'portfolio',
    });
    this.logger.log(`Intelligence digest generated for user ${userId}`);
    return { sent: true, digest, notification };
  }
}
