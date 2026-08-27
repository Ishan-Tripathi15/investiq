import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Observable } from 'rxjs';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { SecurityNotificationsService, type SecurityNotificationSseMessage } from './security-notifications.service';

@Controller('security/notifications')
@UseGuards(AuthGuard, PermissionGuard('account:read'))
export class SecurityNotificationsController {
  constructor(private readonly notifications: SecurityNotificationsService) {}

  @Get('preferences')
  async getPreferences(@Req() req: AuthenticatedRequest) { return this.notifications.getPreferences(req.user!.id); }

  @Post('preferences')
  async setPreferences(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    const allowed = new Set(['enabled', 'minimumSeverity', 'deliveryMode', 'quietHours']);
    const unknown = Object.keys(body).filter((key) => !allowed.has(key));
    if (unknown.length) throw new BadRequestException('Unsupported notification preference');
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') throw new BadRequestException('enabled must be boolean');
    if (body.minimumSeverity !== undefined && !['critical','high','medium','low'].includes(String(body.minimumSeverity))) throw new BadRequestException('Invalid minimumSeverity');
    if (body.deliveryMode !== undefined && !['immediate','digest'].includes(String(body.deliveryMode))) throw new BadRequestException('Invalid deliveryMode');
    if (body.quietHours !== undefined && typeof body.quietHours !== 'boolean') throw new BadRequestException('quietHours must be boolean');
    return this.notifications.setPreferences(req.user!.id, body);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query('afterId') afterId?: string, @Query('limit') limit?: string) {
    return this.notifications.list(req.user!.id, Number(afterId ?? 0), Number(limit ?? 50));
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notifications.unreadCount(req.user!.id);
  }

  @Post(':id/read')
  async markRead(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    const updated = await this.notifications.markRead(req.user!.id, id);
    if (!updated) throw new BadRequestException('Notification was not found');
    return { success: true };
  }

  @Sse('stream')
  stream(@Req() req: AuthenticatedRequest, @Query('afterId') afterId?: string): Observable<SecurityNotificationSseMessage> {
    return this.notifications.stream(req.user!.id, Number(afterId ?? 0));
  }
}
