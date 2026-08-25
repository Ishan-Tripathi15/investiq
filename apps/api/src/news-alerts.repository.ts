import { Injectable } from '@nestjs/common';
import { NewsAlert } from './news-alerts.types';

@Injectable()
export class NewsAlertsRepository {
  private readonly alerts = new Map<string, NewsAlert>();

  list(symbol?: string) {
    return [...this.alerts.values()].filter((alert) => !symbol || alert.symbol === symbol);
  }

  create(alert: NewsAlert) {
    this.alerts.set(alert.id, alert);
    return alert;
  }

  find(id: string) {
    return this.alerts.get(id);
  }

  delete(id: string) {
    return this.alerts.delete(id);
  }
}
