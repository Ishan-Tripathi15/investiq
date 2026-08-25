import { Injectable } from '@nestjs/common';

@Injectable()
export class Phase8AuditService {
  summary() {
    const checks = [
      { id: 'news-provider', status: process.env.GNEWS_API_KEY ? 'ready' : 'configuration-required', detail: 'Verified financial-news provider' },
      { id: 'fundamentals-provider', status: process.env.TWELVE_DATA_API_KEY ? 'ready' : 'configuration-required', detail: 'Verified market/fundamental provider' },
      { id: 'redis', status: process.env.REDIS_URL ? 'ready' : 'optional', detail: 'Production cache' },
      { id: 'notification-delivery', status: process.env.NOTIFICATION_DELIVERY_URL ? 'ready' : 'configuration-required', detail: 'External notification delivery' },
    ] as const;
    const blocking = checks.filter(check => check.status === 'configuration-required').map(check => check.id);
    return { phase: 8, status: blocking.length ? 'configuration-required' : 'ready', checks, blocking, generatedAt: new Date().toISOString() };
  }
}
