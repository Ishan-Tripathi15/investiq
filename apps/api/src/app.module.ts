import { Controller, Get, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { requestContextMiddleware } from './request-context.middleware';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';

@Controller('health')
class HealthController { @Get() health() { return { status: 'ok', service: 'investiq-api', version: 'v1' }; } }

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] })],
  controllers: [HealthController, AuthController, MarketDataController, FundamentalsController, TradingController, TradingRiskController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpObservabilityInterceptor },
    AuthRepository, AuthService, AuthGuard,
    MarketDataService, MarketDataRepository, MarketDataCache, MutualFundsService, FundamentalsService,
    HistoricalValuationService, TradingRepository, TradingRiskService, TradingService,
    TradingReconciliationService, TradingEventsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestContextMiddleware).forRoutes('*');
  }
}
