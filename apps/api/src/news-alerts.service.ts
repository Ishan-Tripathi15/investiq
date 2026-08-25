import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NewsAlertsRepository } from './news-alerts.repository';
import { NewsAlert, NewsAlertKind } from './news-alerts.types';

@Injectable()
export class NewsAlertsService {
  constructor(private readonly repository: NewsAlertsRepository) {}

  list(symbol?: string) {
    return this.repository.list(symbol?.trim().toUpperCase());
  }

  create(symbol: string, kind: NewsAlertKind = 'any') {
    const normalized = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,24}$/.test(normalized)) throw new BadRequestException('Invalid stock symbol');
    if (!['positive', 'negative', 'any'].includes(kind)) throw new BadRequestException('Invalid alert kind');
    const alert: NewsAlert = { id: randomUUID(), symbol: normalized, kind, enabled: true, createdAt: new Date().toISOString() };
    return this.repository.create(alert);
  }

  remove(id: string) {
    if (!this.repository.delete(id)) throw new NotFoundException('News alert not found');
    return { deleted: true };
  }
}
