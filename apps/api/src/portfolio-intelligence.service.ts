import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildPortfolioIntelligence, buildRiskTwin, type PortfolioProfile } from '@investiq/domain';
import { TradingService } from './trading.service';
import { ProfileService } from './profile.service';

@Injectable()
export class PortfolioIntelligenceService {
  constructor(
    private readonly trading: TradingService,
    private readonly profile: ProfileService,
  ) {}

  async analyze(userId: string) {
    const [account, positions, profile] = await Promise.all([
      this.trading.account(userId),
      this.trading.positions(userId),
      this.profile.get(userId),
    ]);

    if (account.totalEquity === undefined) {
      throw new ServiceUnavailableException('Verified account equity is unavailable');
    }

    const holdings = positions.map((position) => ({
      symbol: position.symbol,
      marketValue: position.marketValue,
    }));

    const portfolioProfile: PortfolioProfile = {
      ...(profile.riskProfile === 'conservative' || profile.riskProfile === 'moderate' || profile.riskProfile === 'aggressive'
        ? { riskTolerance: profile.riskProfile }
        : {}),
    };

    const intelligence = buildPortfolioIntelligence(
      account.totalEquity,
      account.availableCash ?? 0,
      holdings,
      portfolioProfile,
    );

    const riskTwin = buildRiskTwin({
      equity: account.totalEquity,
      availableCash: account.availableCash ?? 0,
      positions: holdings,
    });

    return {
      userId,
      generatedAt: new Date().toISOString(),
      source: { provider: account.broker, verified: true },
      intelligence,
      riskTwin,
    };
  }
}
