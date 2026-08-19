import { Injectable } from '@nestjs/common';
import { Observable, interval, from, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { TradingRepository } from './trading.repository';
import type { TradingEvent } from './trading-events.types';

export interface TradingSseMessage { type: string; data: TradingEvent | { status: 'connected'; afterId: number }; id?: string; }

@Injectable()
export class TradingEventsService {
  constructor(private readonly repository: TradingRepository) {}
  list(userId: string, afterId = 0, limit = 100) { return this.repository.listAuditEvents(userId, afterId, limit); }
  stream(userId: string, afterId = 0): Observable<TradingSseMessage> {
    let cursor = Number.isFinite(afterId) && afterId > 0 ? Math.floor(afterId) : 0;
    const initial: TradingSseMessage = { type: 'trading.connected', data: { status: 'connected', afterId: cursor } };
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.repository.listAuditEvents(userId, cursor, 100)).pipe(catchError(() => of([] as TradingEvent[])))),
      map((events) => {
        if (!events.length) return initial;
        const event = events[events.length - 1]; cursor = typeof event.id === 'number' ? event.id : Number(event.id);
        return { type: event.type, data: event, id: String(event.id) } satisfies TradingSseMessage;
      }),
    );
  }
}
