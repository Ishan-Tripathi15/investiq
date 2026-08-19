import { Controller, Get, Module } from '@nestjs/common';
import { MarketDataCache } from './market-data.cache';
import { MarketDataController } from './market-data.controller';
import { MarketDataRepository } from './market-data.repository';
import { MarketDataService } from './market-data.service';
import { MutualFundsService } from './mutual-funds.service';
import { FundamentalsController } from './fundamentals.controller';
import { FundamentalsService } from './fundamentals.service';
import { HistoricalValuationService } from './historical-valuation.service';
import { TradingController } from './trading.controller';
import { TradingEventsService } from './trading-events.service';
import { TradingReconciliationService } from './trading-reconciliation.service';
import { TradingRepository } from './trading.repository';
import { TradingRiskController } from './trading-risk.controller';
import { TradingRiskService } from './trading-risk.service';
import { TradingService } from './trading.service';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'investiq-api', version: 'v1' };
  }
}

@Module({
  controllers: [HealthController, MarketDataController, FundamentalsController, TradingController, TradingRiskController],
  providers: [
    MarketDataService, MarketDataRepository, MarketDataCache, MutualFundsService, FundamentalsService,
    HistoricalValuationService, TradingRepository, TradingRiskService, TradingService,
    TradingReconciliationService, TradingEventsService,
  ],
})
export class AppModule {}
