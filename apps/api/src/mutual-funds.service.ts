import { Injectable } from '@nestjs/common';
import { createMutualFundProvider, MutualFundProvider } from './mutual-funds.provider';
import { FundDetailResponse, FundHistoricalResponse, FundSchemeSearchResponse } from './mutual-funds.types';
import { FundPerformancePeriod, FundPerformanceResponse } from './mutual-fund-performance.types';

@Injectable()
export class MutualFundsService {
  private readonly provider: MutualFundProvider = createMutualFundProvider();
  getProvider(): MutualFundProvider { return this.provider; }
  async search(query: string, limit?: number): Promise<FundSchemeSearchResponse> { return this.provider.search(query, limit); }
  async detail(schemeCode: string): Promise<FundDetailResponse> {
    const normalized = schemeCode.trim();
    if (!/^\d+$/.test(normalized)) return { available: false, scheme: null, source: null, message: 'schemeCode must be numeric.' };
    const result = await this.provider.search(normalized, 1);
    const scheme = result.results.find((item) => item.schemeCode === normalized) ?? null;
    return { available: Boolean(scheme), scheme, source: scheme ? result.source : null, message: scheme ? undefined : result.message ?? 'Verified mutual-fund scheme was not found.' };
  }
  async history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse> { return this.provider.history(schemeId, from, to); }
  async performance(schemeId: string, period: FundPerformancePeriod = '1Y'): Promise<FundPerformanceResponse> {
    const periods: Record<FundPerformancePeriod, number | null> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095, '5Y': 1825, MAX: null };
    const days = periods[period];
    if (days === undefined) return { schemeId, period, available: false, points: [], source: null, message: 'Unsupported performance period.' };
    const end = new Date();
    const from = days == null ? undefined : new Date(end.getTime() - days * 86400000).toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    const result = await this.history(schemeId, from, to);
    const points = result.points;
    if (!result.available || points.length < 2) return { schemeId, period, available: false, points, source: result.source, message: result.message ?? 'Insufficient verified NAV observations for this period.' };
    const startNav = points[0]!.nav;
    const endNav = points[points.length - 1]!.nav;
    const returnPercent = startNav > 0 ? ((endNav - startNav) / startNav) * 100 : undefined;
    return { schemeId, period, available: true, points, startNav, endNav, returnPercent, source: result.source };
  }
}
