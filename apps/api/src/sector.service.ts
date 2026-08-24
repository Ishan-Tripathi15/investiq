import { Injectable } from '@nestjs/common';
import { MarketSource } from './market-data.types';
import { SectorOverviewResponse, SectorSnapshot } from './sector.types';

@Injectable()
export class SectorService {
  private readonly names = [
    ['financials', 'Financial Services'], ['information-technology', 'Information Technology'],
    ['energy', 'Energy'], ['automobile', 'Automobile'], ['pharma', 'Pharmaceuticals'],
    ['industrials', 'Industrials'], ['fmcg', 'FMCG'], ['metals', 'Metals'],
  ] as const;

  overview(): SectorOverviewResponse {
    // Sector performance is intentionally unavailable until a verified provider exposes it.
    const sectors: SectorSnapshot[] = this.names.map(([id, name]) => ({ id, name, direction: 'unavailable', source: null }));
    return {
      available: false,
      sectors,
      strongest: null,
      weakest: null,
      source: null,
      message: 'Verified sector-performance data is not currently supplied by the configured market-data provider.',
    };
  }
}
