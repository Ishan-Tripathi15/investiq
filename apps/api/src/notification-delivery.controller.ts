import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { NotificationDeliveryService } from './notification-delivery.service';

interface RegisterDeviceBody { id?: unknown; platform?: unknown; provider?: unknown; pushToken?: unknown; }

@Controller('security/notification-delivery')
@UseGuards(AuthGuard, PermissionGuard('account:read'))
export class NotificationDeliveryController {
  constructor(private readonly delivery: NotificationDeliveryService) {}

  @Post('devices')
  registerDevice(@Req() req: AuthenticatedRequest, @Body() body: RegisterDeviceBody) {
    if (typeof body.id !== 'string' || typeof body.pushToken !== 'string' || !['ios', 'android'].includes(String(body.platform)) || !['expo', 'apns', 'fcm'].includes(String(body.provider))) {
      throw new BadRequestException('Invalid notification device');
    }
    return this.delivery.registerDevice(req.user!.id, { id: body.id, platform: body.platform as 'ios' | 'android', provider: body.provider as 'expo' | 'apns' | 'fcm', pushToken: body.pushToken });
  }

  @Post('devices/:id/disable')
  returnDisable(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.delivery.disableDevice(req.user!.id, id);
  }

  @Get('deliveries')
  deliveries(@Req() req: AuthenticatedRequest) {
    return this.delivery.listDeliveries(req.user!.id);
  }
}
