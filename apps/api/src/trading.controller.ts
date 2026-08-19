import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Sse, UseGuards } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { OrderRequest } from '@investiq/domain';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';
import { TradingEventsService, type TradingSseMessage } from './trading-events.service';
import { TradingService } from './trading.service';
import { TradingReconciliationService } from './trading-reconciliation.service';

@Controller('trading')
export class TradingController {
  constructor(
    private readonly trading: TradingService,
    private readonly reconciliation: TradingReconciliationService,
    private readonly events: TradingEventsService,
  ) {}

  @Get('status') status() { return this.trading.status(); }
  @Get('capabilities') capabilities() { return this.trading.capabilities(); }

  @Get('quote')
  quote(@Query('symbol') symbol?: string) {
    if (!symbol?.trim()) throw new BadRequestException('symbol query parameter is required');
    return this.trading.quote(symbol);
  }

  @UseGuards(AuthGuard, PermissionGuard('orders:create'))
  @Post('orders/preview') preview(@Body() request: OrderRequest) { return this.trading.preview(request); }

  @UseGuards(AuthGuard, PermissionGuard('orders:create'))
  @Post('orders') placeOrder(@Body() request: OrderRequest, @Headers('idempotency-key') idempotencyKey?: string) { return this.trading.placeOrder(request, idempotencyKey); }

  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Get('orders') listOrders() { return this.trading.listOrders(); }

  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Get('orders/:id') getOrder(@Param('id') id: string) { return this.trading.getOrder(id); }

  @UseGuards(AuthGuard, PermissionGuard('orders:cancel'))
  @Post('orders/:id/cancel') cancelOrder(@Param('id') id: string) { return this.trading.cancelOrder(id); }

  @UseGuards(AuthGuard, PermissionGuard('portfolio:read'))
  @Get('positions') positions() { return this.trading.positions(); }

  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Get('account') account() { return this.trading.account(); }

  @UseGuards(AuthGuard, PermissionGuard('account:read'))
  @Get('reconciliation') reconcile() { return this.reconciliation.reconcile(); }

  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Get('events') listEvents(@Query('afterId') afterId?: string, @Query('limit') limit?: string) { return this.events.list(Number(afterId ?? 0), Number(limit ?? 100)); }

  @UseGuards(AuthGuard, PermissionGuard('orders:read'))
  @Sse('events/stream') eventStream(@Query('afterId') afterId?: string): Observable<TradingSseMessage> { return this.events.stream(Number(afterId ?? 0)); }
}
