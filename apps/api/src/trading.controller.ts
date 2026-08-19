import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, Sse, UseGuards } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { OrderRequest } from '@investiq/domain';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { PermissionGuard } from './permission.guard';
import { TradingEventsService, type TradingSseMessage } from './trading-events.service';
import { TradingService } from './trading.service';
import { TradingReconciliationService } from './trading-reconciliation.service';

@Controller('trading')
export class TradingController {
  constructor(private readonly trading: TradingService, private readonly reconciliation: TradingReconciliationService, private readonly events: TradingEventsService) {}
  @Get('status') status() { return this.trading.status(); }
  @Get('capabilities') capabilities() { return this.trading.capabilities(); }
  @Get('quote') quote(@Query('symbol') symbol?: string) { if (!symbol?.trim()) throw new BadRequestException('symbol query parameter is required'); return this.trading.quote(symbol); }

  @UseGuards(AuthGuard, PermissionGuard('orders:create'))
  @Post('orders/preview') preview(@Req() req: AuthenticatedRequest, @Body() request: OrderRequest) { return this.trading.preview(req.user!.id, request); }
  @UseGuards(AuthGuard, PermissionGuard('orders:create'))
  @Post('orders') placeOrder(@Req() req: AuthenticatedRequest, @Body() request: OrderRequest, @Headers('idempotency-key') key?: string) { return this.trading.placeOrder(req.user!.id, request, key); }
  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Get('orders') listOrders(@Req() req: AuthenticatedRequest) { return this.trading.listOrders(req.user!.id); }
  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Get('orders/:id') getOrder(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.trading.getOrder(req.user!.id, id); }
  @UseGuards(AuthGuard, PermissionGuard('orders:cancel'))
  @Post('orders/:id/cancel') cancelOrder(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.trading.cancelOrder(req.user!.id, id); }
  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('positions') positions(@Req() req: AuthenticatedRequest) { return this.trading.positions(req.user!.id); }
  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Get('account') account(@Req() req: AuthenticatedRequest) { return this.trading.account(req.user!.id); }
  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Get('reconciliation') reconcile(@Req() req: AuthenticatedRequest) { return this.reconciliation.reconcile(req.user!.id); }
  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Get('events') listEvents(@Req() req: AuthenticatedRequest, @Query('afterId') afterId?: string, @Query('limit') limit?: string) { return this.events.list(req.user!.id, Number(afterId ?? 0), Number(limit ?? 100)); }
  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Sse('events/stream') eventStream(@Req() req: AuthenticatedRequest, @Query('afterId') afterId?: string): Observable<TradingSseMessage> { return this.events.stream(req.user!.id, Number(afterId ?? 0)); }
}
