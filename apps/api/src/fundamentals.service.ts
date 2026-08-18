import { Injectable } from '@nestjs/common';
import { createFundamentalsProvider, FundamentalsProvider } from './fundamentals.provider';
import { FundamentalsResponse } from './fundamentals.types';

@Injectable()
export class FundamentalsService {
  private readonly provider: FundamentalsProvider = createFundamentalsProvider();
  getProvider(): FundamentalsProvider { return this.provider; }
  async get(symbol: string): Promise<FundamentalsResponse> { return this.provider.fundamentals(symbol); }
}
