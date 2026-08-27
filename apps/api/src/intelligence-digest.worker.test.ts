import { describe, expect, it, vi } from 'vitest';
import { IntelligenceDigestWorker } from './intelligence-digest.worker';

describe('IntelligenceDigestWorker', () => {
  it('does not send when the schedule says not to send', async () => {
    const intelligence = { actionCenter: vi.fn() };
    const notifications = { createIntelligenceAction: vi.fn() };
    const worker = new IntelligenceDigestWorker(intelligence as any, notifications as any);
    const result = await worker.run('u1', { enabled: false, frequency: 'daily', hour: 9, minute: 0 } as any);
    expect(result.sent).toBe(false);
    expect(intelligence.actionCenter).not.toHaveBeenCalled();
  });

  it('suppresses a digest with no urgent intelligence', async () => {
    const intelligence = { actionCenter: vi.fn().mockResolvedValue({ actions: [] }) };
    const notifications = { createIntelligenceAction: vi.fn() };
    const worker = new IntelligenceDigestWorker(intelligence as any, notifications as any);
    const result = await worker.run('u1', { enabled: true, frequency: 'daily', hour: 0, minute: 0 } as any);
    expect(result.sent).toBe(false);
    expect(notifications.createIntelligenceAction).not.toHaveBeenCalled();
  });
});
