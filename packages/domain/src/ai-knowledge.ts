export type KnowledgeTrust = 'authoritative' | 'educational';

export interface KnowledgeDocument {
  id: string;
  title: string;
  topic: string;
  trust: KnowledgeTrust;
  source: string;
  updatedAt: string;
  content: string;
}

export interface KnowledgeHit {
  documentId: string;
  title: string;
  topic: string;
  trust: KnowledgeTrust;
  source: string;
  updatedAt: string;
  score: number;
  snippet: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*:\s*(you|ignore|override)/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /developer\s*:\s*/i,
  /execute\s+(this|the)\s+(command|instruction)/i,
  /transfer\s+funds?/i,
];

export const INVESTIQ_KNOWLEDGE: readonly KnowledgeDocument[] = [
  {
    id: 'risk-management-basics',
    title: 'Risk management basics',
    topic: 'risk',
    trust: 'educational',
    source: 'InvestIQ curated financial education',
    updatedAt: '2026-08-20',
    content: 'Risk management should define position size, maximum loss, exposure limits, drawdown limits, and invalidation conditions before an order is submitted. Historical risk statistics describe observed behavior and do not guarantee future outcomes.',
  },
  {
    id: 'order-types',
    title: 'Order types and execution',
    topic: 'trading',
    trust: 'educational',
    source: 'InvestIQ curated trading education',
    updatedAt: '2026-08-20',
    content: 'Market orders prioritize execution but may experience slippage. Limit orders specify an acceptable price but may not fill. Stop and stop-limit orders require careful understanding of trigger behavior, gaps, liquidity, and exchange rules. Live execution must remain subject to broker capabilities and deterministic pre-trade risk checks.',
  },
  {
    id: 'valuation-principles',
    title: 'Equity valuation principles',
    topic: 'valuation',
    trust: 'educational',
    source: 'InvestIQ curated financial education',
    updatedAt: '2026-08-20',
    content: 'P/E compares market value with earnings, P/B compares market value with book value, P/S compares market value with revenue, and EV/EBITDA compares enterprise value with EBITDA. Ratios should be interpreted with growth, margins, capital intensity, leverage, cyclicality, and peer context rather than in isolation.',
  },
  {
    id: 'technical-analysis',
    title: 'Technical analysis concepts',
    topic: 'technical',
    trust: 'educational',
    source: 'InvestIQ curated market education',
    updatedAt: '2026-08-20',
    content: 'Moving averages, volatility, drawdowns, momentum, support and resistance are descriptive tools for analyzing market behavior. They are not guarantees of future direction. Indicators should be evaluated across appropriate timeframes and with liquidity and regime changes in mind.',
  },
  {
    id: 'mutual-fund-basics',
    title: 'Mutual fund analysis',
    topic: 'mutual-funds',
    trust: 'educational',
    source: 'InvestIQ curated mutual-fund education',
    updatedAt: '2026-08-20',
    content: 'Mutual-fund analysis should distinguish NAV history, returns, rolling returns, volatility, drawdown, expense impact, benchmark comparison, and portfolio objectives. Historical CAGR and SIP backtests describe past observations and should never be represented as promised returns.',
  },
  {
    id: 'portfolio-diversification',
    title: 'Portfolio diversification and concentration',
    topic: 'portfolio',
    trust: 'educational',
    source: 'InvestIQ curated portfolio education',
    updatedAt: '2026-08-20',
    content: 'Portfolio risk can increase when holdings share the same sector, factor, geography, or market theme. Concentration should be evaluated using position weights, correlated exposures, liquidity, and stress scenarios. Diversification reduces some risks but cannot eliminate market losses.',
  },
  {
    id: 'ai-responsible-use',
    title: 'Responsible use of AI in financial analysis',
    topic: 'ai-safety',
    trust: 'educational',
    source: 'InvestIQ AI safety policy',
    updatedAt: '2026-08-20',
    content: 'AI-generated analysis must be grounded in verified data, identify uncertainty, cite supporting evidence, and distinguish historical observations from projections. AI must not be the authority for account balances, market prices, regulatory status, or trade execution. Deterministic controls remain authoritative.',
  },
];

function tokenize(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((token) => token.length >= 2);
}

function containsInjection(value: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

function snippet(content: string, terms: Set<string>): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const position = [...terms].map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, position - 90);
  return normalized.slice(start, Math.min(normalized.length, start + 280));
}

export function retrieveKnowledge(query: string, limit = 5): KnowledgeHit[] {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length > 500 || containsInjection(cleanQuery)) return [];

  const terms = new Set(tokenize(cleanQuery));
  const safeLimit = Math.max(1, Math.min(8, Math.floor(limit)));

  return INVESTIQ_KNOWLEDGE.map((document) => {
    const documentTerms = new Set(tokenize(`${document.title} ${document.topic} ${document.content}`));
    let matches = 0;
    for (const term of terms) if (documentTerms.has(term)) matches += 1;
    const titleMatches = tokenize(`${document.title} ${document.topic}`).filter((term) => terms.has(term)).length;
    const score = Math.round((matches / Math.max(1, terms.size)) * 70 + titleMatches * 10);
    return {
      documentId: document.id,
      title: document.title,
      topic: document.topic,
      trust: document.trust,
      source: document.source,
      updatedAt: document.updatedAt,
      score,
      snippet: snippet(document.content, terms),
    };
  })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId))
    .slice(0, safeLimit);
}

export function buildKnowledgeContext(query: string, limit = 5): KnowledgeHit[] {
  return retrieveKnowledge(query, limit).map((hit) => ({ ...hit }));
}
