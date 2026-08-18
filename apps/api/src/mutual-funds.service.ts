import { Injectable } from '@nestjs/common';
import { createMutualFundProvider, MutualFundProvider } from './mutual-funds.provider';
import { FundHistoricalResponse, FundSchemeSearchResponse } from './mutual-funds.types';

@Injectable()
export class MutualFundsService {
  private readonly provider: MutualFundProvider = createMutualFundProvider();

  getProvider(): MutualFundProvider { return this.provider; }

  async search(query: string, limit?: number): Promise<FundSchemeSearchResponse> {
    return this.provider.search(query, limit);
  }

  async history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse> {
    return this.provider.history(schemeId, from, to);
  }
}
