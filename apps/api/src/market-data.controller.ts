import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MutualFundsService } from './mutual-funds.service';
import { HistoricalResponse } from './market-data.types';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService, private readonly mutualFunds: MutualFundsService) {}

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
      message: health.live || health.historical || fundHealth.historical ? 'Market and mutual-fund responses are sourced from verified providers at request time.' : 'No verified market provider is configured. InvestIQ will not fabricate market data.',
    };
  }

  @Get('instruments/search')
  async instrumentSearch(@Query('q') query = '', @Query('country') country = 'India') {
    if (query.trim().length > 100) throw new BadRequestException('q must be 100 characters or fewer');
    if (country.trim().length > 80) throw new BadRequestException('country must be 80 characters or fewer');
    return this.marketData.searchInstruments(query, country);
  }

  @Get('instruments')
  async instruments(@Query('country') country = 'India', @Query('type') type = 'Common Stock', @Query('page') page = '1', @Query('pageSize') pageSize = '100') {
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > 10000) throw new BadRequestException('page must be an integer between 1 and 10000');
    if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 5000) throw new BadRequestException('pageSize must be an integer between 1 and 5000');
    return this.marketData.listInstruments(country, type, parsedPage, parsedPageSize);
  }

  @Get('stocks/:symbol/history')
  async stockHistory(@Param('symbol') symbol: string, @Query('from') from?: string, @Query('to') to?: string): Promise<HistoricalResponse> {
    return this.marketData.history(symbol, from, to);
  }

  @Get('funds/search')
  async fundSearch(@Query('q') query = '', @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.mutualFunds.search(query, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }

  @Get('funds/:schemeId/history')
  async fundHistory(@Param('schemeId') schemeId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.mutualFunds.history(schemeId, from, to);
  }
}
