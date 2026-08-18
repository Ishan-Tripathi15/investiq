import { Controller, Get, Param, Query } from '@nestjs/common';
import { UnconfiguredMarketDataProvider } from './market-data.provider';
import { HistoricalResponse } from './market-data.types';

@Controller('market-data')
export class MarketDataController {
  private readonly provider = new UnconfiguredMarketDataProvider();

  @Get('status')
  async status() {
    const health = await this.provider.health();
    return {
      status: health.live || health.historical ? 'available' : 'provider_required',
      provider: this.provider.name,
      ...health,
      message: health.live || health.historical
        ? 'Verified market-data provider is available.'
        : 'No market provider is configured. InvestIQ will not fabricate market data.',
    };
  }

  @Get('stocks/:symbol/history')
  async stockHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<HistoricalResponse> {
    return this.provider.stockHistory(symbol, from, to);
  }

  @Get('funds/:schemeId/history')
  fundHistory(@Param('schemeId') schemeId: string) {
    return {
      schemeId,
      available: false,
      points: [],
      source: null,
      message: 'Historical NAV data becomes available after a verified provider is configured.',
    };
  }
}
