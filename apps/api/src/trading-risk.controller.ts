import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { OrderRequest } from '@investiq/domain';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { TradingRiskService } from './trading-risk.service';

@Controller('trading/risk')
export class TradingRiskController {
  constructor(private readonly risk: TradingRiskService) {}

  @UseGuards(AuthGuard, PermissionGuard('orders:create'))
  @Post('evaluate')
  evaluate(@Req() req: AuthenticatedRequest, @Body() request: OrderRequest) {
    return this.risk.evaluate(req.user!.id, request);
  }
}
