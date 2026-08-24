import { Controller, Get, Query } from '@nestjs/common';
import { MutualFundsService } from './mutual-funds.service';
import { FundPerformancePeriod } from './mutual-fund-performance.types';

@Controller('mutual-funds')
export class MutualFundsController {
  constructor(private readonly service: MutualFundsService) {}
  @Get('search') search(@Query('q') q = '', @Query('limit') limit?: string) { const parsedLimit = limit ? Number(limit) : undefined; return this.service.search(q.trim(), Number.isFinite(parsedLimit) ? parsedLimit : undefined); }
  @Get('detail') detail(@Query('schemeCode') schemeCode = '') { return this.service.detail(schemeCode); }
  @Get('performance') performance(@Query('schemeId') schemeId = '', @Query('period') period: FundPerformancePeriod = '1Y') { return this.service.performance(schemeId.trim(), period); }
}
