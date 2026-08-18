import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MutualFundsService } from './mutual-funds.service';
import { HistoricalResponse } from './market-data.types';

@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly marketData: MarketDataService,
    private readonly mutualFunds: MutualFundsService,
  ) {}

  @Get('status')
  async status() {
    const health = await this.marketData.getProvider().health();
    const fundHealth = await this.mutualFunds.getProvider().health();
    return {
      status: health.live || health.historical || fundHealth.historical ? 'configured' : 'provider_required',
      provider: health.live || health.historical ? this.marketData.getProvider().name : 'unconfigured',
      mutualFundProvider: this.mutualFunds.getProvider().name,
      ...health,
      mutualFundHistorical: fundHealth.historical,
      message: health.live || health.historical || fundHealth.historical
        ? 'Market and mutual-fund responses are sourced from verified providers at request time.'
        : 'No verified market provider is configured. InvestIQ will not fabricate market data.',
    };
  }

  @Get('stocks/:symbol/history')
  async stockHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<HistoricalResponse> {
    return this.marketData.history(symbol, from, to);
  }

  @Get('funds/:schemeId/history')
  async fundHistory(
    @Param('schemeId') schemeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.mutualFunds.history(schemeId, from, to);
  }
}
