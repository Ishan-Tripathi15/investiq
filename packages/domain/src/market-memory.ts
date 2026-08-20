export type MarketRegime = 'bull' | 'bear' | 'sideways' | 'high_volatility';

export interface MarketMemoryPoint {
  timestamp: string;
  symbol: string;
  regime: MarketRegime;
  price: number;
  returnPct?: number;
  volatilityPct?: number;
  drawdownPct?: number;
  eventTags?: string[];
  source: { provider: string; retrievedAt: string; verified: boolean };
}

export interface MarketMemoryQuery {
  symbol?: string;
  regime?: MarketRegime;
  from?: string;
  to?: string;
  eventTag?: string;
  limit?: number;
}

export interface MarketMemoryResult {
  points: MarketMemoryPoint[];
  observations: number;
  sources: string[];
  asOf: string;
}

export function queryMarketMemory(points: MarketMemoryPoint[], query: MarketMemoryQuery = {}): MarketMemoryResult {
  const symbol = query.symbol?.trim().toUpperCase();
  const from = query.from ? new Date(query.from).getTime() : Number.NEGATIVE_INFINITY;
  const to = query.to ? new Date(query.to).getTime() : Number.POSITIVE_INFINITY;
  const limit = Math.max(1, Math.min(500, Math.floor(query.limit ?? 100)));
  const filtered = points
    .filter((point) => point.source.verified)
    .filter((point) => !symbol || point.symbol.toUpperCase() === symbol)
    .filter((point) => !query.regime || point.regime === query.regime)
    .filter((point) => !query.eventTag || point.eventTags?.includes(query.eventTag))
    .filter((point) => {
      const time = new Date(point.timestamp).getTime();
      return Number.isFinite(time) && time >= from && time <= to;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit);
  return {
    points: filtered,
    observations: filtered.length,
    sources: [...new Set(filtered.map((point) => point.source.provider))],
    asOf: new Date().toISOString(),
  };
}

export interface PortfolioMemoryLink {
  symbol: string;
  weightPct: number;
  regimes: MarketRegime[];
  historicalDrawdownPct?: number;
}

export function summarizePortfolioMemory(links: PortfolioMemoryLink[]) {
  const total = links.reduce((sum, link) => sum + Math.max(0, link.weightPct), 0);
  const concentration = links.length === 0 ? 0 : Math.max(...links.map((link) => Math.max(0, link.weightPct)));
  const regimeExposure: Record<MarketRegime, number> = { bull: 0, bear: 0, sideways: 0, high_volatility: 0 };
  for (const link of links) {
    for (const regime of link.regimes) regimeExposure[regime] += link.weightPct / Math.max(1, link.regimes.length);
  }
  return { totalWeightPct: total, largestPositionPct: concentration, regimeExposure };
}
