import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildAiAnalysisContext, buildKnowledgeContext, buildRiskTwin, calculateStockStats } from '@investiq/domain';
import { createAiProvider, type AiProvider } from './ai.provider';
import { MarketDataService } from './market-data.service';
import { TradingService } from './trading.service';

@Injectable()
export class AiService {
  private readonly provider: AiProvider = createAiProvider();
  constructor(private readonly marketData: MarketDataService, private readonly trading: TradingService) {}
  status() { return this.provider.health(); }
  knowledge(query: string, limit = 5) { const normalized = query.trim(); if (!normalized) throw new ServiceUnavailableException('Knowledge query is required'); return buildKnowledgeContext(normalized, limit); }
  async riskTwin(userId: string) {
    const account = await this.trading.account(userId);
    const positions = await this.trading.positions(userId);
    if (account.totalEquity === undefined) throw new ServiceUnavailableException('Verified account equity is unavailable');
    return buildRiskTwin({ equity: account.totalEquity, availableCash: account.availableCash ?? 0, positions: positions.map((position) => ({ symbol: position.symbol, marketValue: position.marketValue })) });
  }
  async analyzeSymbol(symbol: string) {
    const normalized = symbol.trim().toUpperCase(); if (!normalized) throw new ServiceUnavailableException('Symbol is required');
    const history = await this.marketData.history(normalized);
    if (!history.available || history.points.length < 2 || !history.source) throw new ServiceUnavailableException(history.message ?? 'Verified market history is unavailable');
    const stats = calculateStockStats(history.points.map((point) => ({ timestamp: point.timestamp, close: point.close })));
    const knowledge = buildKnowledgeContext(`${normalized} market analysis valuation technical risk portfolio trading`, 5);
    const context = buildAiAnalysisContext(normalized, new Date().toISOString(), { periodReturnPct: stats.absoluteReturnPct, cagrPct: stats.cagrPct, volatilityPct: stats.annualizedVolatilityPct, maxDrawdownPct: stats.maxDrawdownPct }, [
      { kind: 'price', provider: history.source.provider, retrievedAt: history.source.retrievedAt, verified: true, observationCount: history.points.length },
      { kind: 'risk', provider: history.source.provider, retrievedAt: history.source.retrievedAt, verified: true, observationCount: history.points.length },
    ], knowledge);
    if (!context.quality.complete) throw new ServiceUnavailableException({ message: 'AI analysis requires a sufficiently complete verified dataset', quality: context.quality });
    const health = this.provider.health(); if (!health.configured) throw new ServiceUnavailableException(health.message);
    const analysis = await this.provider.analyze(context);
    return { symbol: normalized, dataQuality: context.quality, knowledge, source: history.source, analysis };
  }
}
