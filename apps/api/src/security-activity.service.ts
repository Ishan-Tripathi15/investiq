import { Injectable } from '@nestjs/common';
import { SecurityActivityRepository, type SecurityActivityRecord } from './security-activity.repository';

@Injectable()
export class SecurityActivityService {
  constructor(private readonly repository: SecurityActivityRepository) {}

  async record(userId: string, eventType: string, metadata: Record<string, unknown> = {}, requestId?: string): Promise<void> {
    await this.repository.record({ userId, eventType, metadata, requestId });
  }

  list(userId: string, limit = 50): Promise<SecurityActivityRecord[]> {
    return this.repository.list(userId, limit);
  }
}
