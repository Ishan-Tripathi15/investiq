import { Controller, Get, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MarketDataCache } from './market-data.cache';
import { MarketDataController } from './market-data.controller';
import { MarketDataRepository } from './market-data.repository';
import { MarketDataService } from './market-data.service';
import { MutualFundsService } from './mutual-funds.service';
import { MutualFundsController } from './mutual-funds.controller';
import { MutualFundAnalyticsController } from './mutual-fund-analytics.controller';
import { MutualFundAnalyticsService } from './mutual-fund-analytics.service';
import { MutualFundComparisonController } from './mutual-fund-comparison.controller';
import { MutualFundComparisonService } from './mutual-fund-comparison.service';
import { MutualFundWatchlistController } from './mutual-fund-watchlist.controller';
import { MutualFundWatchlistRepository } from './mutual-fund-watchlist.repository';
import { MutualFundWatchlistService } from './mutual-fund-watchlist.service';
import { MutualFundIntelligenceController } from './mutual-fund-intelligence.controller';
import { MutualFundIntelligenceService } from './mutual-fund-intelligence.service';
import { FundamentalsController } from './fundamentals.controller';
import { FundamentalsService } from './fundamentals.service';
import { FundamentalIntelligenceController } from './fundamental-intelligence.controller';
import { FundamentalIntelligenceService } from './fundamental-intelligence.service';
import { HistoricalValuationService } from './historical-valuation.service';
import { TradingController } from './trading.controller';
import { TradingEventsService } from './trading-events.service';
import { TradingReconciliationService } from './trading-reconciliation.service';
import { TradingRepository } from './trading.repository';
import { TradingRiskController } from './trading-risk.controller';
import { TradingRiskService } from './trading-risk.service';
import { TradingService } from './trading.service';
import { TradingStateService } from './trading-state.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthRiskService } from './auth-risk.service';
import { MfaController } from './mfa.controller';
import { MfaRepository } from './mfa.repository';
import { MfaService } from './mfa.service';
import { ProfileController } from './profile.controller';
import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { KycService } from './kyc.service';
import { requestContextMiddleware } from './request-context.middleware';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';
import { BrokerConnectionController } from './broker-connection.controller';
import { BrokerConnectionRepository } from './broker-connection.repository';
import { BrokerConnectionService } from './broker-connection.service';
import { TransactionAuthorizationRepository } from './transaction-authorization.repository';
import { TransactionAuthorizationService } from './transaction-authorization.service';
import { SecurityActivityController } from './security-activity.controller';
import { SecurityActivityRepository } from './security-activity.repository';
import { SecurityActivityService } from './security-activity.service';
import { SecurityNotificationsController } from './security-notifications.controller';
import { SecurityNotificationsRepository } from './security-notifications.repository';
import { SecurityNotificationsService } from './security-notifications.service';
import { NotificationDeliveryController } from './notification-delivery.controller';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { NotificationDeliveryService } from './notification-delivery.service';
import { PortfolioIntelligenceController } from './portfolio-intelligence.controller';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';
import { IntelligenceDigestController } from './intelligence-digest.controller';
import { PortfolioCopilotController } from './portfolio-copilot.controller';
import { PortfolioMemoryRepository } from './portfolio-memory.repository';
import { WatchlistController } from './watchlist.controller';
import { WatchlistRepository } from './watchlist.repository';
import { WatchlistService } from './watchlist.service';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsAlertsController } from './news-alerts.controller';
import { NewsAlertsRepository } from './news-alerts.repository';
import { NewsAlertsService } from './news-alerts.service';
import { MarketOverviewController } from './market-overview.controller';
import { MarketOverviewService } from './market-overview.service';
import { SectorController } from './sector.controller';
import { SectorService } from './sector.service';
import { PortfolioHistoryRepository } from './portfolio-history.repository';
import { PortfolioHistoryService } from './portfolio-history.service';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';
import { Phase8AuditController } from './phase8-audit.controller';
import { Phase8AuditService } from './phase8-audit.service';

@Controller('health')
class HealthController { @Get() health() { return { status: 'ok', service: 'investiq-api', version: 'v1' }; } }

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] })],
  controllers: [HealthController, AuthController, MfaController, ProfileController, AiController, PortfolioIntelligenceController, IntelligenceDigestController, PortfolioCopilotController, SecurityActivityController, SecurityNotificationsController, NotificationDeliveryController, MarketDataController, FundamentalsController, FundamentalIntelligenceController, TradingController, TradingRiskController, BrokerConnectionController, WatchlistController, NewsController, NewsAlertsController, MarketOverviewController, SectorController, MutualFundsController, MutualFundAnalyticsController, MutualFundComparisonController, MutualFundWatchlistController, MutualFundIntelligenceController, Phase8AuditController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpObservabilityInterceptor },
    AuthRepository, AuthService, AuthRiskService, AuthGuard, MfaRepository, MfaService, ProfileRepository, ProfileService, KycService,
    SecurityActivityRepository, SecurityActivityService, SecurityNotificationsRepository, SecurityNotificationsService,
    NotificationDeliveryRepository, NotificationDeliveryService, AiService,
    PortfolioIntelligenceService, PortfolioMemoryRepository,
    MarketDataService, MarketDataRepository, MarketDataCache, MutualFundsService, MutualFundAnalyticsService, MutualFundComparisonService, MutualFundWatchlistRepository, MutualFundWatchlistService, MutualFundIntelligenceService, FundamentalsService, FundamentalIntelligenceService,
    HistoricalValuationService, TradingRepository, TradingRiskService, TradingService, TradingStateService,
    TradingReconciliationService, TradingEventsService,
    BrokerConnectionRepository, BrokerConnectionService,
    TransactionAuthorizationRepository, TransactionAuthorizationService,
    PortfolioHistoryRepository, PortfolioHistoryService, PortfolioAnalyticsService,
    WatchlistRepository, WatchlistService, NewsService, NewsAlertsRepository, NewsAlertsService, MarketOverviewService, SectorService,
    Phase8AuditService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(requestContextMiddleware).forRoutes('*'); }
}