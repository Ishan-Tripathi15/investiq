import { FundHistoricalPoint, FundHistoricalResponse } from './mutual-funds.types';

export interface MutualFundProvider {
  readonly name: string;
  health(): Promise<{ historical: boolean }>;
  history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse>;
}

const AMFI_BASE = 'https://portal.amfiindia.com/NavHistoryReport_Rpt_Po.aspx';
const MAX_DAYS_PER_REQUEST = 90;

function parseDate(value: string): Date | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const monthName = match[2];
  const month = monthName ? months[monthName] : undefined;
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
    const dateValue = columns[6];
    const date = dateValue ? parseDate(dateValue) : null;
    if (!Number.isFinite(nav) || !date) continue;
    points.push({ timestamp: date.toISOString(), nav });
  }
  return points;
}

export class UnconfiguredMutualFundProvider implements MutualFundProvider {
  readonly name = 'amfi-unavailable';
  async health() { return { historical: false }; }
  async history(schemeId: string): Promise<FundHistoricalResponse> {
    return { schemeId, available: false, points: [], source: null, message: 'AMFI mutual-fund history is unavailable.' };
  }
}

export class AmfiMutualFundProvider implements MutualFundProvider {
  readonly name = 'amfi';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  async health() { return { historical: true }; }

  async history(schemeId: string, from?: string, to?: string): Promise<FundHistoricalResponse> {
    const [mf, scm] = schemeId.split(':').map((value) => value.trim());
    if (!mf || !scm || !/^\d+$/.test(mf) || !/^\d+$/.test(scm)) {
      return {
        schemeId, available: false, points: [], source: null,
        message: 'schemeId must use the verified AMFI format mfCode:schemeCode, for example 22:119598.',
      };
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
        const chunkEnd = new Date(Math.min(end.getTime(), cursor.getTime() + (MAX_DAYS_PER_REQUEST - 1) * 24 * 60 * 60 * 1000));
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
        cursor = new Date(chunkEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const unique = new Map(points.map((point) => [point.timestamp, point]));
      const sorted = [...unique.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const response: FundHistoricalResponse = {
        schemeId,
        available: sorted.length > 0,
        points: sorted,
        source: sorted.length > 0 ? { provider: this.name, retrievedAt: new Date().toISOString() } : null,
      };
      if (sorted.length === 0) response.message = 'AMFI returned no NAV observations for this scheme/date range.';
      return response;
    } catch (error) {
      return {
        schemeId, available: false, points: [], source: null,
        message: error instanceof Error ? error.message : 'AMFI request failed.',
      };
    }
  }
}

export function createMutualFundProvider(): MutualFundProvider {
  return new AmfiMutualFundProvider();
}
