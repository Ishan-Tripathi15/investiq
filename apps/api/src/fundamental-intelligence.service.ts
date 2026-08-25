import { Injectable } from '@nestjs/common';
import { FundamentalsService } from './fundamentals.service';
import { intelligenceFromSnapshot } from './fundamental-intelligence.types';

@Injectable()
export class FundamentalIntelligenceService {
  constructor(private readonly fundamentals: FundamentalsService) {}

  async get(symbol: string) {
    const response = await this.fundamentals.get(symbol);
    if (!response.available || !response.data || !response.source) {
      return { symbol: response.symbol, available: false, score: null, band: 'insufficient-data', coveragePct: 0, valuation: {}, profitability: {}, balanceSheet: {}, cashFlow: {}, trends: {}, source: response.source, message: response.message ?? 'Verified fundamentals are unavailable.' };
    }
    return intelligenceFromSnapshot(response.data, response.source);
  }
}
