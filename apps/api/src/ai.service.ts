import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildAiAnalysisContext, calculateStockStats } from '@investiq/domain';
import { createAiProvider, type AiProvider } from './ai.provider';
import { MarketDataService } from './market-data.service';

@Injectable()
export class AiService {
  private readonly provider: AiProvider = createAiProvider();

  constructor(private readonly marketData: MarketDataService) {}

  status() {
    return this.provider.health();
  }

  async analyzeSymbol(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) throw new ServiceUnavailableException('Symbol is required');

    const history = await this.marketData.history(normalized);
    if (!history.available || history.points.length < 2 || !history.source) {
      throw new ServiceUnavailableException(history.message ?? 'Verified market history is unavailable');
    }

    const stats = calculateStockStats(history.points.map((point) => ({ timestamp: point.timestamp, close: point.close })));
    const context = buildAiAnalysisContext(
      normalized,
      new Date().toISOString(),
      {
        periodReturnPct: stats.absoluteReturnPct,
        cagrPct: stats.cagrPct,
        volatilityPct: stats.annualizedVolatilityPct,
        maxDrawdownPct: stats.maxDrawdownPct,
      },
      [{ kind: 'price', provider: history.source.provider, retrievedAt: history.source.retrievedAt, verified: true, observationCount: history.points.length },
        { kind: 'risk', provider: history.source.provider, retrievedAt: history.source.retrievedAt, verified: true, observationCount: history.points.length }],
    );

    if (!context.quality.complete) {
      throw new ServiceUnavailableException({ message: 'AI analysis requires a sufficiently complete verified dataset', quality: context.quality });
    }

    const health = this.provider.health();
    if (!health.configured) throw new ServiceUnavailableException(health.message);
    const analysis = await this.provider.analyze(context);
    return { symbol: normalized, dataQuality: context.quality, source: history.source, analysis };
  }
}
