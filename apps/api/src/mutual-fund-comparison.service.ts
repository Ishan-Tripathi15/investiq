import { Injectable } from '@nestjs/common';
import { MutualFundsService } from './mutual-funds.service';
import { FundPerformancePeriod } from './mutual-fund-performance.types';
import { MutualFundComparisonResponse } from './mutual-fund-comparison.types';

@Injectable()
export class MutualFundComparisonService {
  constructor(private readonly funds: MutualFundsService) {}

  async compare(schemeCodes: string[], period: FundPerformancePeriod = '1Y'): Promise<MutualFundComparisonResponse> {
    const unique = [...new Set(schemeCodes.map((x) => x.trim()).filter((x) => /^\d+$/.test(x)))].slice(0, 4);
    if (unique.length < 2) return { available: false, period, results: [], message: 'Provide at least 2 valid numeric scheme codes to compare.' };
    const results = await Promise.all(unique.map(async (schemeCode) => {
      const detail = await this.funds.detail(schemeCode);
      const performance = await this.funds.performance(schemeCode, period);
      const scheme = detail.scheme;
      return {
        schemeCode,
        schemeName: scheme?.schemeName ?? `Scheme ${schemeCode}`,
        category: scheme?.category,
        nav: scheme?.nav,
        navDate: scheme?.date,
        returnPercent: performance.returnPercent,
        performancePeriod: period,
        source: performance.source ?? detail.source,
        available: Boolean(scheme && performance.available),
        message: performance.available ? undefined : performance.message ?? detail.message,
      };
    }));
    const available = results.some((item) => item.available);
    return { available, period, results, message: available ? undefined : 'Verified comparison data is not available for the selected schemes and period.' };
  }
}
