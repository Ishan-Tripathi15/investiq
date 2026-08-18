import { FundamentalSnapshot, FinancialPeriod, FundamentalsResponse } from './fundamentals.types';

export interface FundamentalsProvider {
  readonly name: string;
  health(): Promise<{ available: boolean }>;
  fundamentals(symbol: string): Promise<FundamentalsResponse>;
}

export class UnconfiguredFundamentalsProvider implements FundamentalsProvider {
  readonly name = 'unconfigured';
  async health() { return { available: false }; }
  async fundamentals(symbol: string): Promise<FundamentalsResponse> {
    return { symbol: symbol.toUpperCase(), available: false, data: null, source: null, message: 'No verified fundamentals provider is configured.' };
  }
}

type Json = Record<string, unknown>;
function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}
function nested(obj: Json | undefined, ...keys: string[]): number | undefined {
  let current: unknown = obj;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Json)[key];
  }
  return num(current);
}
function first(...values: Array<number | undefined>): number | undefined { return values.find((v) => v !== undefined); }
function pct(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.abs(value) <= 2 ? value * 100 : value;
}

export class TwelveDataFundamentalsProvider implements FundamentalsProvider {
  readonly name = 'twelve-data';
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY;
  private readonly baseUrl = process.env.TWELVE_DATA_BASE_URL ?? 'https://api.twelvedata.com';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  async health() { return { available: Boolean(this.apiKey) }; }

  private async request(path: string, symbol: string, params: Record<string, string> = {}): Promise<Json> {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set('symbol', symbol.toUpperCase());
    url.searchParams.set('apikey', this.apiKey!);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.json() as Json;
      if (!response.ok || body.status === 'error') throw new Error(String(body.message ?? `Fundamentals provider returned HTTP ${response.status}`));
      return body;
    } finally { clearTimeout(timeout); }
  }

  async fundamentals(symbol: string): Promise<FundamentalsResponse> {
    if (!this.apiKey) return new UnconfiguredFundamentalsProvider().fundamentals(symbol);
    try {
      const [statsBody, incomeBody, balanceBody, cashBody] = await Promise.all([
        this.request('/statistics', symbol),
        this.request('/income_statement', symbol, { period: 'annual', outputsize: '10' }),
        this.request('/balance_sheet', symbol, { period: 'annual', outputsize: '10' }),
        this.request('/cash_flow', symbol, { period: 'annual', outputsize: '10' }),
      ]);

      const stats = (statsBody.statistics ?? {}) as Json;
      const valuation = (stats.valuations_metrics ?? {}) as Json;
      const financials = (stats.financials ?? {}) as Json;
      const incomeStats = (financials.income_statement ?? {}) as Json;
      const balanceStats = (financials.balance_sheet ?? {}) as Json;
      const cashStats = (financials.cash_flow ?? {}) as Json;
      const stockStats = (stats.stock_statistics ?? {}) as Json;

      const incomeRows = Array.isArray(incomeBody.income_statement) ? incomeBody.income_statement as Json[] : [];
      const balanceRows = Array.isArray(balanceBody.balance_sheet) ? balanceBody.balance_sheet as Json[] : [];
      const cashRows = Array.isArray(cashBody.cash_flow) ? cashBody.cash_flow as Json[] : [];
      const byDate = new Map<string, FinancialPeriod>();
      for (const row of incomeRows) {
        const fiscalDate = String(row.fiscal_date ?? '');
        if (!fiscalDate) continue;
        const period: FinancialPeriod = { fiscalDate };
        period.revenue = first(num(row.sales), nested(row.revenue as Json, 'total_revenue'));
        period.grossProfit = first(num(row.gross_profit), nested(row.gross_profit as Json, 'gross_profit_value'));
        period.ebit = first(num(row.ebit), num(row.operating_income), nested(row.operating_income as Json, 'operating_income_value'));
        period.ebitda = first(num(row.ebitda), nested(row.ebitda as Json, 'ebitda_value'));
        period.netIncome = first(num(row.net_income), nested(row.net_income as Json, 'net_income_value'));
        period.eps = first(num(row.eps_diluted), nested(row.earnings_per_share as Json, 'diluted_eps'));
        if (period.revenue && period.revenue !== 0) period.grossMarginPct = period.grossProfit === undefined ? undefined : period.grossProfit / period.revenue * 100;
        if (period.revenue && period.revenue !== 0) period.operatingMarginPct = period.ebit === undefined ? undefined : period.ebit / period.revenue * 100;
        if (period.revenue && period.revenue !== 0) period.netMarginPct = period.netIncome === undefined ? undefined : period.netIncome / period.revenue * 100;
        byDate.set(fiscalDate, period);
      }
      for (const row of balanceRows) {
        const date = String(row.fiscal_date ?? ''); const period = byDate.get(date);
        if (!period) continue;
        const liabilities = row.liabilities as Json | undefined;
        const assets = row.assets as Json | undefined;
        period.totalDebt = first(nested(row, 'total_debt'), nested(row, 'liabilities', 'total_debt'), nested(liabilities, 'non_current_liabilities', 'long_term_debt_and_capital_lease_obligation', 'total_long_term_debt_and_capital_lease_obligation'));
        period.totalCash = first(nested(row, 'total_cash'), nested(assets, 'current_assets', 'cash_and_cash_equivalents'));
      }
      for (const row of cashRows) {
        const date = String(row.fiscal_date ?? ''); const period = byDate.get(date);
        if (!period) continue;
        period.operatingCashFlow = first(nested(row, 'operating_activities', 'net_cash_provided_by_used_in_operating_activities'), nested(row, 'operating_activities', 'total_cash_from_operating_activities'));
        period.freeCashFlow = first(nested(row, 'free_cash_flow'), nested(row, 'cash_flow_from_operating_activities', 'free_cash_flow'));
      }

      const snapshot: FundamentalSnapshot = {
        symbol: symbol.toUpperCase(),
        name: typeof (statsBody.meta as Json | undefined)?.name === 'string' ? String((statsBody.meta as Json).name) : undefined,
        currency: typeof (statsBody.meta as Json | undefined)?.currency === 'string' ? String((statsBody.meta as Json).currency) : undefined,
        exchange: typeof (statsBody.meta as Json | undefined)?.exchange === 'string' ? String((statsBody.meta as Json).exchange) : undefined,
        marketCap: num(valuation.market_capitalization), enterpriseValue: num(valuation.enterprise_value), pe: num(valuation.trailing_pe), forwardPe: num(valuation.forward_pe), peg: num(valuation.peg_ratio), priceToSales: num(valuation.price_to_sales_ttm), priceToBook: num(valuation.price_to_book_mrq), evToRevenue: num(valuation.enterprise_to_revenue), evToEbitda: num(valuation.enterprise_to_ebitda),
        revenue: num(incomeStats.revenue_ttm), ebitda: num(incomeStats.ebitda), netIncome: num(incomeStats.net_income_to_common_ttm), eps: num(incomeStats.diluted_eps_ttm), operatingCashFlow: num(cashStats.operating_cash_flow_ttm), freeCashFlow: num(cashStats.levered_free_cash_flow_ttm), totalDebt: num(balanceStats.total_debt_mrq), totalCash: num(balanceStats.total_cash_mrq), roe: pct(num(financials.return_on_equity_ttm)), roa: pct(num(financials.return_on_assets_ttm)), grossMarginPct: pct(num(financials.gross_margin)), operatingMarginPct: pct(num(financials.operating_margin)), netMarginPct: pct(num(financials.profit_margin)), insiderOwnershipPct: pct(num(stockStats.percent_held_by_insiders)), institutionalOwnershipPct: pct(num(stockStats.percent_held_by_institutions)),
        periods: [...byDate.values()].sort((a, b) => a.fiscalDate.localeCompare(b.fiscalDate)),
      };
      return { symbol: symbol.toUpperCase(), available: true, data: snapshot, source: { provider: this.name, retrievedAt: new Date().toISOString() } };
    } catch (error) {
      return { symbol: symbol.toUpperCase(), available: false, data: null, source: null, message: error instanceof Error ? error.message : 'Fundamentals provider request failed.' };
    }
  }
}

export function createFundamentalsProvider(): FundamentalsProvider {
  return process.env.TWELVE_DATA_API_KEY ? new TwelveDataFundamentalsProvider() : new UnconfiguredFundamentalsProvider();
}
