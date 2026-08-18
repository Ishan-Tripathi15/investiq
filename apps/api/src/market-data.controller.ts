import { Controller, Get, Param } from '@nestjs/common';

@Controller('market-data')
export class MarketDataController {
  @Get('status')
  status() {
    return {
      status: 'provider_required',
      live: false,
      historical: false,
      source: null,
      message: 'No market provider is configured. InvestIQ will not fabricate market data.',
    };
  }

  @Get('stocks/:symbol/history')
  stockHistory(@Param('symbol') symbol: string) {
    return {
      symbol: symbol.toUpperCase(),
      available: false,
      points: [],
      source: null,
      message: 'Historical stock data becomes available after a verified provider is configured.',
    };
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
