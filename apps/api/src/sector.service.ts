import { Injectable } from '@nestjs/common';
import { MarketSource } from './market-data.types';
import { PortfolioSectorExposure, PortfolioSectorExposureResponse, SectorOverviewResponse, SectorSnapshot } from './sector.types';

type Position = { symbol?: string; marketValue?: number };
type ProfileResponse = { symbol?: string; sector?: string; status?: string; message?: string };

@Injectable()
export class SectorService {
  private readonly names = [
    ['financials', 'Financial Services'], ['information-technology', 'Information Technology'],
    ['energy', 'Energy'], ['automobile', 'Automobile'], ['pharma', 'Pharmaceuticals'],
    ['industrials', 'Industrials'], ['fmcg', 'FMCG'], ['metals', 'Metals'],
  ] as const;
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY;
  private readonly baseUrl = process.env.TWELVE_DATA_BASE_URL ?? 'https://api.twelvedata.com';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  overview(): SectorOverviewResponse {
    const sectors: SectorSnapshot[] = this.names.map(([id, name]) => ({ id, name, direction: 'unavailable', source: null }));
    return {
      available: false,
      sectors,
      strongest: null,
      weakest: null,
      source: null,
      message: 'Sector performance is separate from portfolio sector exposure and remains unavailable until a verified sector-index feed is configured.',
    };
  }

  async portfolioExposure(positions: Position[]): Promise<PortfolioSectorExposureResponse> {
    const valid = positions.filter((position) => typeof position.symbol === 'string' && position.symbol.trim() && Number.isFinite(position.marketValue) && (position.marketValue ?? 0) > 0);
    const totalMarketValue = valid.reduce((sum, position) => sum + (position.marketValue ?? 0), 0);
    if (!this.apiKey) return { available: false, totalMarketValue, classifiedMarketValue: 0, unclassifiedMarketValue: totalMarketValue, classifiedCoveragePercent: 0, sectors: [], source: null, message: 'Verified security-sector metadata is unavailable because the configured market-data provider is not configured.' };
    if (valid.length === 0) return { available: false, totalMarketValue: 0, classifiedMarketValue: 0, unclassifiedMarketValue: 0, classifiedCoveragePercent: 0, sectors: [], source: null, message: 'No verified positive-market-value portfolio positions are available for sector classification.' };

    const uniqueSymbols = [...new Set(valid.map((position) => position.symbol!.trim().toUpperCase()))].slice(0, 50);
    const profiles = await Promise.all(uniqueSymbols.map(async (symbol) => {
      try {
        const url = new URL('/profile', this.baseUrl);
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('apikey', this.apiKey!);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await fetch(url, { signal: controller.signal });
          const body = await response.json() as ProfileResponse;
          if (!response.ok || body.status === 'error' || !body.sector?.trim()) return [symbol, null] as const;
          return [symbol, body.sector.trim()] as const;
        } finally { clearTimeout(timeout); }
      } catch { return [symbol, null] as const; }
    }));
    const sectorBySymbol = new Map(profiles);
    const aggregates = new Map<string, { marketValue: number; holdings: number }>();
    let classifiedMarketValue = 0;
    for (const position of valid) {
      const symbol = position.symbol!.trim().toUpperCase();
      const sector = sectorBySymbol.get(symbol);
      if (!sector) continue;
      const value = position.marketValue!;
      const current = aggregates.get(sector) ?? { marketValue: 0, holdings: 0 };
      current.marketValue += value;
      current.holdings += 1;
      aggregates.set(sector, current);
      classifiedMarketValue += value;
    }
    const sectors: PortfolioSectorExposure[] = [...aggregates.entries()].map(([sector, data]) => ({ sector, marketValue: data.marketValue, weightPercent: totalMarketValue > 0 ? data.marketValue / totalMarketValue * 100 : 0, holdings: data.holdings })).sort((a, b) => b.marketValue - a.marketValue);
    const unclassifiedMarketValue = Math.max(0, totalMarketValue - classifiedMarketValue);
    const source: MarketSource = { provider: 'twelve-data-profile', retrievedAt: new Date().toISOString() };
    return { available: sectors.length > 0, totalMarketValue, classifiedMarketValue, unclassifiedMarketValue, classifiedCoveragePercent: totalMarketValue > 0 ? classifiedMarketValue / totalMarketValue * 100 : 0, sectors, source, message: sectors.length === 0 ? 'Verified security-sector metadata was not returned for the current portfolio.' : unclassifiedMarketValue > 0 ? 'Some portfolio positions could not be classified from verified provider metadata.' : undefined };
  }
}
