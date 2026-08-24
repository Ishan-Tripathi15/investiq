import { Injectable } from '@nestjs/common';
import { MutualFundsService } from './mutual-funds.service';
import { FundAnalyticsResponse } from './mutual-fund-analytics.types';

@Injectable()
export class MutualFundAnalyticsService {
  constructor(private readonly funds: MutualFundsService) {}

  async get(schemeId: string): Promise<FundAnalyticsResponse> {
    const detail = await this.funds.detail(schemeId);
    if (!detail.available || !detail.scheme) {
      return { schemeId, available: false, source: detail.source, message: detail.message ?? 'Verified mutual-fund details are unavailable.' };
    }
    return {
      schemeId,
      available: true,
      category: detail.scheme.category,
      source: detail.source,
      message: 'Only metrics supplied by the configured verified provider are shown; additional analytics remain unavailable until supported.'
    };
  }
}
