import { Controller, Get, Query } from '@nestjs/common';
import { MutualFundComparisonService } from './mutual-fund-comparison.service';
import { FundPerformancePeriod } from './mutual-fund-performance.types';

@Controller('mutual-funds/compare')
export class MutualFundComparisonController {
  constructor(private readonly service: MutualFundComparisonService) {}

  @Get()
  compare(@Query('schemes') schemes = '', @Query('period') period = '1Y') {
    const parsedPeriod = period as FundPerformancePeriod;
    return this.service.compare(schemes.split(',').map((x) => x.trim()), parsedPeriod);
  }
}
