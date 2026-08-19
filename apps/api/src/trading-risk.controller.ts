import { Body, Controller, Post } from '@nestjs/common';
import type { OrderRequest } from '@investiq/domain';
import { TradingRiskService } from './trading-risk.service';

@Controller('trading/risk')
export class TradingRiskController {
  constructor(private readonly risk: TradingRiskService) {}

  @Post('evaluate')
  evaluate(@Body() request: OrderRequest) {
    return this.risk.evaluate(request);
  }
}
