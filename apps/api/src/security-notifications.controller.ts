import { BadRequestException, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Sse, UseGuards } from '@nestjs/common';
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
  async getPreferences(@Req() req: AuthenticatedRequest) { return this.service.getPreferences(req.user!.id); }

  @Post('preferences')
  async setPreferences(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.service.setPreferences(req.user!.id, body); }

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
