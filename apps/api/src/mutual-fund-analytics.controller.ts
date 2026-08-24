import { Controller, Get, Param } from '@nestjs/common';
import { MutualFundAnalyticsService } from './mutual-fund-analytics.service';

@Controller('mutual-funds')
export class MutualFundAnalyticsController {
  constructor(private readonly analytics: MutualFundAnalyticsService) {}

  @Get(':schemeId/analytics')
  analyticsForScheme(@Param('schemeId') schemeId: string) {
    return this.analytics.get(schemeId);
  }
}
