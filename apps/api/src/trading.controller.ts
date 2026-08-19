import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { OrderRequest } from '@investiq/domain';
import { TradingService } from './trading.service';

@Controller('trading')
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Get('status')
  status() {
    return this.trading.status();
  }

  @Post('orders/preview')
  preview(@Body() request: OrderRequest) {
    return this.trading.preview(request);
  }

  @Post('orders')
  placeOrder(@Body() request: OrderRequest) {
    return this.trading.placeOrder(request);
  }

  @Get('orders')
  listOrders() {
    return this.trading.listOrders();
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.trading.getOrder(id);
  }

  @Post('orders/:id/cancel')
  cancelOrder(@Param('id') id: string) {
    return this.trading.cancelOrder(id);
  }

  @Get('positions')
  positions() {
    return this.trading.positions();
  }

  @Get('account')
  account() {
    return this.trading.account();
  }
}
