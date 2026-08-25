import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { TradingService } from './trading.service';
import { SectorService } from './sector.service';

@Controller('sector-overview')
export class SectorController {
  constructor(private readonly sectorService: SectorService, private readonly trading: TradingService) {}

  @Get()
  overview() {
    return this.sectorService.overview();
  }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('portfolio')
  async portfolio(@Req() req: AuthenticatedRequest) {
    const positions = await this.trading.positions(req.user!.id);
    return this.sectorService.portfolioExposure(positions);
  }
}
