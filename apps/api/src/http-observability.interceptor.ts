import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';
import type { RequestContextRequest } from './request-context.middleware';

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestContextRequest>();
    const res = http.getResponse<Response>();
    const requestId = req.requestId ?? randomUUID();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res, requestId, started),
        error: () => this.log(req, res, requestId, started),
      }),
    );
  }

  private log(req: Request, res: Response, requestId: string, started: bigint): void {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const status = res.statusCode;
    const payload = JSON.stringify({
      event: 'http.request',
      requestId,
      method: req.method,
      path: req.originalUrl?.split('?')[0] ?? req.url.split('?')[0],
      status,
      durationMs: Math.round(durationMs * 100) / 100,
    });
    if (status >= 500) this.logger.error(payload);
    else if (status >= 400) this.logger.warn(payload);
    else this.logger.log(payload);
  }
}
