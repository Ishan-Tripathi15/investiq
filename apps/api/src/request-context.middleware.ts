import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestContextRequest extends Request {
  requestId?: string;
}

function validRequestId(value: string | undefined): value is string {
  return Boolean(value && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value));
}

export function requestContextMiddleware(req: RequestContextRequest, res: Response, next: NextFunction): void {
  const incoming = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
  const requestId = validRequestId(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
