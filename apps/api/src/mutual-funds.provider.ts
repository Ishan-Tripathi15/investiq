import { FundHistoricalPoint, FundHistoricalResponse, FundScheme, FundSchemeSearchResponse } from './mutual-funds.types';

export interface MutualFundProvider {
  readonly name: string;
  health(): Promise<{ historical: boolean }>;
  history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse>;
  search(query: string, limit?: number): Promise<FundSchemeSearchResponse>;
}

const AMFI_BASE = 'https://portal.amfiindia.com/NavHistoryReport_Rpt_Po.aspx';
const AMFI_LATEST = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const MAX_DAYS_PER_REQUEST = 90;

function parseDate(value: string): Date | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const month = months[match[2]!];
  if (month == null) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

function formatAmfiDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getUTCDate()}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function parseHistory(body: string): FundHistoricalPoint[] {
  const points: FundHistoricalPoint[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes(';')) continue;
    const columns = line.split(';').map((column) => column.trim());
    if (columns.length < 7) continue;
    const nav = Number(columns[3]);
    const date = columns[6] ? parseDate(columns[6]) : null;
    if (!Number.isFinite(nav) || !date) continue;
    points.push({ timestamp: date.toISOString(), nav });
  }
  return points;
}

function parseLatestSchemes(body: string): FundScheme[] {
  const results: FundScheme[] = [];
  let category = '';
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.includes(';')) {
      if (line.length > 3) category = line;
      continue;
    }
    const columns = line.split(';').map((column) => column.trim());
    if (columns.length < 6 || !/^\d+$/.test(columns[0]!)) continue;
    const nav = Number(columns[4]);
    results.push({
      schemeCode: columns[0]!,
      isinGrowth: columns[1] && columns[1] !== '-' ? columns[1] : undefined,
      isinReinvestment: columns[2] && columns[2] !== '-' ? columns[2] : undefined,
      schemeName: columns[3]!,
      nav: Number.isFinite(nav) ? nav : undefined,
      date: columns[5],
      category,
    });
  }
  return results;
}

export class UnconfiguredMutualFundProvider implements MutualFundProvider {
  readonly name = 'amfi-unavailable';
  async health() { return { historical: false }; }
  async history(schemeId: string): Promise<FundHistoricalResponse> {
    return { schemeId, available: false, points: [], source: null, message: 'AMFI mutual-fund history is unavailable.' };
  }
  async search(query: string): Promise<FundSchemeSearchResponse> {
    return { query, available: false, results: [], source: null, message: 'AMFI mutual-fund search is unavailable.' };
  }
}

export class AmfiMutualFundProvider implements MutualFundProvider {
  readonly name = 'amfi';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);
  private schemesCache: { expiresAt: number; schemes: FundScheme[] } | null = null;

  async health() { return { historical: true }; }

  async search(query: string, limit = 20): Promise<FundSchemeSearchResponse> {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      return { query, available: true, results: [], source: { provider: this.name, retrievedAt: new Date().toISOString() }, message: 'Enter at least 2 characters to search schemes.' };
    }
    try {
      let schemes: FundScheme[];
      if (this.schemesCache && this.schemesCache.expiresAt > Date.now()) {
        schemes = this.schemesCache.schemes;
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await fetch(AMFI_LATEST, { signal: controller.signal });
          if (!response.ok) throw new Error(`AMFI returned HTTP ${response.status}`);
          schemes = parseLatestSchemes(await response.text());
          this.schemesCache = { expiresAt: Date.now() + 10 * 60 * 1000, schemes };
        } finally {
          clearTimeout(timeout);
        }
      }
      const queryTokens = normalized.split(/\s+/).filter(Boolean);
      const ranked = schemes
        .map((scheme) => {
          const name = scheme.schemeName.toLowerCase();
          const code = scheme.schemeCode;
          const exact = name === normalized || code === normalized;
          const starts = name.startsWith(normalized) || code.startsWith(normalized);
          const tokenHits = queryTokens.filter((token) => name.includes(token)).length;
          return { scheme, score: exact ? 1000 : starts ? 500 : tokenHits * 100 + (name.includes(normalized) ? 50 : 0) };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.scheme.schemeName.localeCompare(b.scheme.schemeName))
        .slice(0, Math.min(50, Math.max(1, limit)))
        .map((item) => item.scheme);
      return { query, available: true, results: ranked, source: { provider: this.name, retrievedAt: new Date().toISOString() } };
    } catch (error) {
      return { query, available: false, results: [], source: null, message: error instanceof Error ? error.message : 'AMFI scheme search failed.' };
    }
  }

  async history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse> {
    const [mf, scm] = schemeId.split(':').map((value) => value.trim());
    if (!mf || !scm || !/^\d+$/.test(mf) || !/^\d+$/.test(scm)) {
      return { schemeId, available: false, points: [], source: null, message: 'schemeId must use the verified AMFI format mfCode:schemeCode.' };
    }
    const end = to ? new Date(`${to}T00:00:00.000Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { schemeId, available: false, points: [], source: null, message: 'Invalid date range.' };
    }
    const points: FundHistoricalPoint[] = [];
    let cursor = new Date(start);
    try {
      while (cursor <= end) {
        const chunkEnd = new Date(Math.min(end.getTime(), cursor.getTime() + (MAX_DAYS_PER_REQUEST - 1) * 86400000));
        const url = new URL(AMFI_BASE);
        url.searchParams.set('rpt', '1');
        url.searchParams.set('frmdate', formatAmfiDate(cursor));
        url.searchParams.set('todate', formatAmfiDate(chunkEnd));
        url.searchParams.set('mf', mf);
        url.searchParams.set('scm', scm);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await fetch(url, { signal: controller.signal });
          const body = await response.text();
          if (!response.ok) throw new Error(`AMFI returned HTTP ${response.status}`);
          points.push(...parseHistory(body));
        } finally {
          clearTimeout(timeout);
        }
        cursor = new Date(chunkEnd.getTime() + 86400000);
      }
      const unique = new Map(points.map((point) => [point.timestamp, point]));
      const sorted = [...unique.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return { schemeId, available: sorted.length > 0, points: sorted, source: sorted.length > 0 ? { provider: this.name, retrievedAt: new Date().toISOString() } : null, message: sorted.length === 0 ? 'AMFI returned no NAV observations for this scheme/date range.' : undefined };
    } catch (error) {
      return { schemeId, available: false, points: [], source: null, message: error instanceof Error ? error.message : 'AMFI request failed.' };
    }
  }
}

export function createMutualFundProvider(): MutualFundProvider { return new AmfiMutualFundProvider(); }
