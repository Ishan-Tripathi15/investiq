import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildPortfolioCopilotContext, buildPortfolioExplanation, buildPortfolioIntelligence, buildRiskTwin, type PortfolioProfile } from '@investiq/domain';
import { TradingService } from './trading.service';
import { ProfileService } from './profile.service';
import { buildKnowledgeContext } from '@investiq/domain';

@Injectable()
export class PortfolioIntelligenceService {
  constructor(private readonly trading: TradingService, private readonly profile: ProfileService) {}

  private async build(userId: string) {
    const [account, positions, profile] = await Promise.all([
      this.trading.account(userId),
      this.trading.positions(userId),
      this.profile.get(userId),
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
    return { account, intelligence, riskTwin };
  }

  async analyze(userId: string) {
    const { account, intelligence, riskTwin } = await this.build(userId);
    return {
      generatedAt: new Date().toISOString(),
      source: { provider: account.broker, verified: true },
      intelligence,
      riskTwin,
      explanation: buildPortfolioExplanation(intelligence, riskTwin),
    };
  }

  async explain(userId: string) {
    const { account, intelligence, riskTwin } = await this.build(userId);
    return {
      generatedAt: new Date().toISOString(),
      source: { provider: account.broker, verified: true },
      explanation: buildPortfolioExplanation(intelligence, riskTwin),
    };
  }

  async copilot(userId: string, question: string) {
    const { intelligence, riskTwin } = await this.build(userId);
    const knowledge = buildKnowledgeContext(`${question} portfolio risk diversification concentration liquidity stress`, 5);
    return buildPortfolioCopilotContext({
      question,
      intelligence,
      riskTwin,
      knowledge,
      asOf: new Date().toISOString(),
    });
  }
}
