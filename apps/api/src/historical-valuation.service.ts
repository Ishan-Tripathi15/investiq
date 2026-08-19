import { Injectable } from '@nestjs/common';
import { buildHistoricalValuation } from '@investiq/domain';
import { FundamentalsService } from './fundamentals.service';
import { HistoricalValuationResponse } from './historical-valuation.types';

type MarketCapRow = { date?: string; value?: number | string };
type Json = Record<string, unknown>;

function numberValue(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

@Injectable()
export class HistoricalValuationService {
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY;
  private readonly baseUrl = process.env.TWELVE_DATA_BASE_URL ?? 'https://api.twelvedata.com';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  constructor(private readonly fundamentals: FundamentalsService) {}

  private async marketCapHistory(symbol: string, from?: string, to?: string): Promise<MarketCapRow[]> {
    if (!this.apiKey) throw new Error('Historical market-cap provider is not configured.');
    const url = new URL('/market_cap', this.baseUrl);
    url.searchParams.set('symbol', symbol.toUpperCase());
    url.searchParams.set('apikey', this.apiKey);
    if (from) url.searchParams.set('start_date', from);
    if (to) url.searchParams.set('end_date', to);
    url.searchParams.set('outputsize', '5000');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.json() as Json;
      if (!response.ok || body.status === 'error') throw new Error(String(body.message ?? `Historical market-cap request failed with HTTP ${response.status}`));
      return Array.isArray(body.market_cap) ? body.market_cap as MarketCapRow[] : [];
    } finally {
      clearTimeout(timeout);
    }
  }

  async get(symbol: string, from?: string, to?: string): Promise<HistoricalValuationResponse> {
    const ticker = symbol.toUpperCase();
    try {
      const [fundamentals, marketCaps] = await Promise.all([
        this.fundamentals.get(ticker),
        this.marketCapHistory(ticker, from, to),
      ]);
      if (!fundamentals.available || !fundamentals.data?.periods.length || !marketCaps.length) {
        return { symbol: ticker, available: false, points: [], source: null, message: 'Verified historical valuation inputs are unavailable for this symbol or provider plan.' };
      }
      const caps = marketCaps
        .map((row) => ({ date: String(row.date ?? ''), value: numberValue(row.value) }))
        .filter((row): row is { date: string; value: number } => Boolean(row.date) && row.value !== undefined)
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

      const inputs = fundamentals.data.periods.map((period) => {
        const fiscalTime = Date.parse(period.fiscalDate);
        let nearest: { date: string; value: number } | undefined;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const cap of caps) {
          const distance = Math.abs(Date.parse(cap.date) - fiscalTime);
          if (distance < nearestDistance) { nearest = cap; nearestDistance = distance; }
        }
        const matched = nearest && nearestDistance <= 7 * 24 * 60 * 60 * 1000 ? nearest : undefined;
        const enterpriseValue = matched?.value !== undefined && period.totalDebt !== undefined && period.totalCash !== undefined
          ? matched.value + period.totalDebt - period.totalCash
          : undefined;
        return {
          date: period.fiscalDate,
          marketCap: matched?.value,
          enterpriseValue,
          earnings: period.netIncome,
          bookValue: period.bookValue,
          revenue: period.revenue,
          ebitda: period.ebitda,
        };
      });

      const ratios = buildHistoricalValuation(inputs);
      const ratioByDate = new Map(ratios.map((point) => [point.date, point]));
      const points = inputs.map((input) => {
        const ratio = ratioByDate.get(input.date);
        const cap = caps.find((candidate) => Math.abs(Date.parse(candidate.date) - Date.parse(input.date)) <= 7 * 24 * 60 * 60 * 1000);
        return {
          fiscalDate: input.date,
          ...(cap ? { marketCap: cap.value, marketCapDate: cap.date } : {}),
          ...(ratio?.pe !== undefined ? { pe: ratio.pe } : {}),
          ...(ratio?.pb !== undefined ? { pb: ratio.pb } : {}),
          ...(ratio?.ps !== undefined ? { ps: ratio.ps } : {}),
          ...(ratio?.evToEbitda !== undefined ? { evToEbitda: ratio.evToEbitda } : {}),
        };
      });
      const usable = points.filter((point) => point.pe !== undefined || point.ps !== undefined || point.pb !== undefined || point.evToEbitda !== undefined);
      return {
        symbol: ticker,
        available: usable.length > 0,
        points: usable,
        source: { provider: 'twelve-data', retrievedAt: new Date().toISOString() },
        ...(usable.length === 0 ? { message: 'Historical market-cap data was available, but no financial-period valuation ratio could be formed without unsupported assumptions.' } : {}),
      };
    } catch (error) {
      return { symbol: ticker, available: false, points: [], source: null, message: error instanceof Error ? error.message : 'Historical valuation is unavailable.' };
    }
  }
}
