import { Injectable } from '@nestjs/common';
import { MutualFundsService } from './mutual-funds.service';
import { FundIntelligenceResponse } from './mutual-fund-intelligence.types';

@Injectable()
export class MutualFundIntelligenceService {
  constructor(private readonly funds: MutualFundsService) {}

  async get(schemeId: string): Promise<FundIntelligenceResponse> {
    const detail = await this.funds.detail(schemeId);
    if (!detail.available || !detail.scheme) return { schemeId, available: false, band: 'insufficient-data', coveragePercent: 0, source: detail.source, message: detail.message ?? 'Verified mutual-fund data is unavailable.' };

    const periods = ['1Y', '3Y', '5Y'] as const;
    const results = await Promise.all(periods.map(async period => [period, await this.funds.performance(schemeId, period)] as const));
    const returns = Object.fromEntries(results.filter(([, value]) => value.available && value.returnPercent != null).map(([period, value]) => [period, value.returnPercent])) as FundIntelligenceResponse['returns'];
    const history = await this.funds.history(schemeId);
    const points = history.available ? history.points : [];
    const dailyReturns: number[] = [];
    for (let i = 1; i < points.length; i++) { const prev = points[i - 1]!.nav; const next = points[i]!.nav; if (prev > 0 && Number.isFinite(next)) dailyReturns.push((next - prev) / prev); }
    const mean = dailyReturns.length ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const variance = dailyReturns.length > 1 ? dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (dailyReturns.length - 1) : undefined;
    const volatilityPercent = variance == null ? undefined : Math.sqrt(variance) * Math.sqrt(252) * 100;
    const availableReturns = Object.keys(returns ?? {}).length;
    const coveragePercent = Math.round(((detail.scheme.category ? 1 : 0) + availableReturns + (volatilityPercent != null ? 1 : 0)) / 5 * 100);
    if (!availableReturns && volatilityPercent == null) return { schemeId, available: false, band: 'insufficient-data', category: detail.scheme.category, latestNav: detail.scheme.nav, observations: points.length, coveragePercent, source: detail.source, message: 'Insufficient verified history to calculate fund intelligence.' };
    const values = Object.values(returns ?? {}).filter((v): v is number => typeof v === 'number');
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
    const score = avg == null ? undefined : Math.max(0, Math.min(100, 50 + avg * 2));
    const band = score == null ? 'mixed' : score >= 75 ? 'strong' : score >= 60 ? 'healthy' : score >= 45 ? 'mixed' : score >= 30 ? 'weak' : 'insufficient-data';
    return { schemeId, available: true, band, score, category: detail.scheme.category, latestNav: detail.scheme.nav, returns, volatilityPercent, observations: points.length, coveragePercent, source: detail.source };
  }
}
