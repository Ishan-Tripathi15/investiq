import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { SecurityActivityService } from './security-activity.service';

@Controller('security')
@UseGuards(AuthGuard)
export class SecurityActivityController {
  constructor(private readonly security: SecurityActivityService) {}

  @Get('activity')
  @UseGuards(PermissionGuard('account:read'))
  activity(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    const parsed = limit === undefined ? 50 : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new BadRequestException('limit must be an integer between 1 and 200');
    return this.security.list(req.user!.id, parsed);
  }
}
