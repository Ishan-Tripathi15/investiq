import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildKnowledgeContext, buildPortfolioCopilotContext, buildPortfolioExplanation, buildPortfolioIntelligence, buildRiskTwin, type PortfolioProfile } from '@investiq/domain';
import { TradingService } from './trading.service';
import { ProfileService } from './profile.service';
import { createPortfolioCopilotProvider, type PortfolioCopilotProvider } from './portfolio-copilot.provider';
import { PortfolioMemoryRepository } from './portfolio-memory.repository';
import { buildPortfolioActionCenter } from '@investiq/domain';

@Injectable()
export class PortfolioIntelligenceService {
  private readonly copilotProvider: PortfolioCopilotProvider = createPortfolioCopilotProvider();

  constructor(
    private readonly trading: TradingService,
    private readonly profile: ProfileService,
    private readonly memory: PortfolioMemoryRepository,
  ) {}

  private async build(userId: string) {
    const [account, positions, profile, brokerHealth] = await Promise.all([
      this.trading.account(userId),
      this.trading.positions(userId),
      this.profile.get(userId),
      this.trading.health(userId),
    ]);
    if (account.totalEquity === undefined) throw new ServiceUnavailableException('Verified account equity is unavailable');

    const holdings = positions.map((position) => ({ symbol: position.symbol, marketValue: position.marketValue }));
    const portfolioProfile: PortfolioProfile = {
      ...(profile.risk_profile === 'conservative' || profile.risk_profile === 'moderate' || profile.risk_profile === 'aggressive'
        ? { riskTolerance: profile.risk_profile }
        : {}),
    };
    const intelligence = buildPortfolioIntelligence(account.totalEquity, account.availableCash ?? 0, holdings, portfolioProfile);
    const riskTwin = buildRiskTwin({ equity: account.totalEquity, availableCash: account.availableCash ?? 0, positions: holdings });
    return { account, intelligence, riskTwin, brokerHealth };
  }

  async analyze(userId: string) {
    const { intelligence, riskTwin, brokerHealth } = await this.build(userId);
    return {
      generatedAt: new Date().toISOString(),
      source: { provider: brokerHealth.broker, verified: true },
      intelligence,
      riskTwin,
      explanation: buildPortfolioExplanation(intelligence, riskTwin),
    };
  }

  async actionCenter(userId: string) {
    const { intelligence } = await this.build(userId);
    const actionCenter = buildPortfolioActionCenter({
      portfolio: {
        riskLevel: intelligence.riskLevel,
        warnings: intelligence.warnings,
        actions: intelligence.actions,
      },
    });
    return {
      generatedAt: new Date().toISOString(),
      source: { type: 'verified-portfolio-intelligence' },
      ...actionCenter,
    };
  }

  async explain(userId: string) {
    const { intelligence, riskTwin, brokerHealth } = await this.build(userId);
    return {
      generatedAt: new Date().toISOString(),
      source: { provider: brokerHealth.broker, verified: true },
      explanation: buildPortfolioExplanation(intelligence, riskTwin),
    };
  }

  private async buildCopilotContext(
    userId: string,
    question: string,
    intelligence: ReturnType<typeof buildPortfolioIntelligence>,
    riskTwin: ReturnType<typeof buildRiskTwin>,
  ) {
    const [knowledge, memory] = await Promise.all([
      Promise.resolve(buildKnowledgeContext(`${question} portfolio risk diversification concentration liquidity stress`, 5)),
      this.memory.listRelevant(userId, question, 5),
    ]);
    return buildPortfolioCopilotContext({ question, intelligence, riskTwin, knowledge, memory, asOf: new Date().toISOString() });
  }

  async copilot(userId: string, question: string) {
    const { intelligence, riskTwin } = await this.build(userId);
    return this.buildCopilotContext(userId, question, intelligence, riskTwin);
  }

  async copilotAnswer(userId: string, question: string) {
    const { intelligence, riskTwin } = await this.build(userId);
    const context = await this.buildCopilotContext(userId, question, intelligence, riskTwin);
    if (!this.copilotProvider.health().configured) {
      throw new ServiceUnavailableException('Portfolio AI copilot is unavailable until AI provider credentials are configured');
    }

    const response = await this.copilotProvider.answer(context);
    await this.memory.add(
      userId,
      question,
      response.answer,
      response as unknown as Record<string, unknown>,
      {
        equity: intelligence.equity,
        cashValue: intelligence.cashValue,
        cashPct: intelligence.cashPct,
        concentrationPct: intelligence.concentrationPct,
        riskLevel: intelligence.riskLevel,
        ...(intelligence.largestPosition ? { largestPosition: intelligence.largestPosition } : {}),
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      source: this.copilotProvider.health(),
      context: {
        asOf: context.asOf,
        answerability: context.answerability,
        evidence: context.evidence,
        memoryUsed: context.memory.map((item) => ({ id: item.id, createdAt: item.createdAt, question: item.question })),
      },
      response,
    };
  }

  async copilotMemory(userId: string, limit = 10) {
    return { items: await this.memory.listRelevant(userId, '', limit) };
  }

  async clearCopilotMemory(userId: string) {
    return { deleted: await this.memory.clear(userId) };
  }

  copilotHealth() {
    return this.copilotProvider.health();
  }
}
