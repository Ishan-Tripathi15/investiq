import { Injectable } from '@nestjs/common';
import { createMutualFundProvider, MutualFundProvider } from './mutual-funds.provider';
import { FundDetailResponse, FundHistoricalResponse, FundSchemeSearchResponse } from './mutual-funds.types';

@Injectable()
export class MutualFundsService {
  private readonly provider: MutualFundProvider = createMutualFundProvider();

  getProvider(): MutualFundProvider { return this.provider; }

  async search(query: string, limit?: number): Promise<FundSchemeSearchResponse> {
    return this.provider.search(query, limit);
  }

  async detail(schemeCode: string): Promise<FundDetailResponse> {
    const normalized = schemeCode.trim();
    if (!/^\d+$/.test(normalized)) return { available: false, scheme: null, source: null, message: 'schemeCode must be numeric.' };
    const result = await this.provider.search(normalized, 1);
    const scheme = result.results.find((item) => item.schemeCode === normalized) ?? null;
    return {
      available: Boolean(scheme),
      scheme,
      source: scheme ? result.source : null,
      message: scheme ? undefined : result.message ?? 'Verified mutual-fund scheme was not found.',
    };
  }

  async history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse> {
    return this.provider.history(schemeId, from, to);
  }
}
