import { Controller, Get, Param, Query } from '@nestjs/common';
import { FundamentalsService } from './fundamentals.service';
import { HistoricalValuationService } from './historical-valuation.service';

@Controller('market-data')
export class FundamentalsController {
  constructor(
    private readonly service: FundamentalsService,
    private readonly valuation: HistoricalValuationService,
  ) {}

  @Get('stocks/:symbol/fundamentals')
  fundamentals(@Param('symbol') symbol: string) {
    return this.service.get(symbol);
  }

  @Get('stocks/:symbol/valuation-history')
  valuationHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.valuation.get(symbol, from, to);
  }

  @Get('fundamentals/status')
  async status() {
    const health = await this.service.getProvider().health();
    return { provider: this.service.getProvider().name, ...health };
  }
}
