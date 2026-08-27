import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SecurityNotificationsController } from './security-notifications.controller';

describe('SecurityNotificationsController', () => {
  const notifications = {
    getPreferences: vi.fn(),
    setPreferences: vi.fn(),
  } as any;

  const controller = new SecurityNotificationsController(notifications);

  it('rejects unsupported preference fields', async () => {
    await expect(controller.setPreferences({ user: { id: 'u1' } } as any, { enabled: true, token: 'secret' })).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.setPreferences).not.toHaveBeenCalled();
  });

  it('rejects invalid preference types and enums', async () => {
    await expect(controller.setPreferences({ user: { id: 'u1' } } as any, { enabled: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.setPreferences({ user: { id: 'u1' } } as any, { minimumSeverity: 'extreme' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.setPreferences({ user: { id: 'u1' } } as any, { deliveryMode: 'instant' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes valid preferences to the service', async () => {
    notifications.setPreferences.mockResolvedValue({ enabled: true, minimumSeverity: 'high', deliveryMode: 'digest', quietHours: false });
    await expect(controller.setPreferences({ user: { id: 'u1' } } as any, { enabled: true, minimumSeverity: 'high', deliveryMode: 'digest', quietHours: false })).resolves.toEqual({ enabled: true, minimumSeverity: 'high', deliveryMode: 'digest', quietHours: false });
  });
});
