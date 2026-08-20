import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildKnowledgeContext, buildPortfolioCopilotContext, buildPortfolioExplanation, buildPortfolioIntelligence, buildRiskTwin, type PortfolioProfile } from '@investiq/domain';
import { TradingService } from './trading.service';
import { ProfileService } from './profile.service';
import { createPortfolioCopilotProvider, type PortfolioCopilotProvider } from './portfolio-copilot.provider';

@Injectable()
export class PortfolioIntelligenceService {
  private readonly copilotProvider: PortfolioCopilotProvider = createPortfolioCopilotProvider();

  constructor(private readonly trading: TradingService, private readonly profile: ProfileService) {}

  private async build(userId: string) {
    const [account, positions, profile, brokerCapabilities] = await Promise.all([
      this.trading.account(userId),
      this.trading.positions(userId),
      this.profile.get(userId),
      this.trading.capabilities(),
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
    return { account, brokerCapabilities, intelligence, riskTwin };
  }

  async analyze(userId: string) {
    const { brokerCapabilities, intelligence, riskTwin } = await this.build(userId);
    return {
      generatedAt: new Date().toISOString(),
      source: { provider: brokerCapabilities?.broker ?? 'unconfigured', verified: true },
      intelligence,
      riskTwin,
      explanation: buildPortfolioExplanation(intelligence, riskTwin),
    };
  }

  async explain(userId: string) {
    const { brokerCapabilities, intelligence, riskTwin } = await this.build(userId);
    return {
      generatedAt: new Date().toISOString(),
      source: { provider: brokerCapabilities?.broker ?? 'unconfigured', verified: true },
      explanation: buildPortfolioExplanation(intelligence, riskTwin),
    };
  }

  private buildCopilotContext(question: string, intelligence: ReturnType<typeof buildPortfolioIntelligence>, riskTwin: ReturnType<typeof buildRiskTwin>) {
    const knowledge = buildKnowledgeContext(`${question} portfolio risk diversification concentration liquidity stress`, 5);
    return buildPortfolioCopilotContext({ question, intelligence, riskTwin, knowledge, asOf: new Date().toISOString() });
  }

  async copilot(userId: string, question: string) {
    const { intelligence, riskTwin } = await this.build(userId);
    return this.buildCopilotContext(question, intelligence, riskTwin);
  }

  async copilotAnswer(userId: string, question: string) {
    const context = await this.copilotContextForUser(userId, question);
    if (!this.copilotProvider.health().configured) {
      throw new ServiceUnavailableException('Portfolio AI copilot is unavailable until AI provider credentials are configured');
    }
    return {
      generatedAt: new Date().toISOString(),
      source: this.copilotProvider.health(),
      context: {
        asOf: context.asOf,
        answerability: context.answerability,
        evidence: context.evidence,
      },
      response: await this.copilotProvider.answer(context),
    };
  }

  private async copilotContextForUser(userId: string, question: string) {
    const { intelligence, riskTwin } = await this.build(userId);
    return this.buildCopilotContext(question, intelligence, riskTwin);
  }

  copilotHealth() {
    return this.copilotProvider.health();
  }
}
