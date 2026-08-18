import { Controller, Get, Module } from '@nestjs/common';
import { MarketDataCache } from './market-data.cache';
import { MarketDataController } from './market-data.controller';
import { MarketDataRepository } from './market-data.repository';
import { MarketDataService } from './market-data.service';
import { MutualFundsService } from './mutual-funds.service';
import { FundamentalsController } from './fundamentals.controller';
import { FundamentalsService } from './fundamentals.service';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'investiq-api', version: 'v1' };
  }
}

@Module({
  controllers: [HealthController, MarketDataController, FundamentalsController],
  providers: [MarketDataService, MarketDataRepository, MarketDataCache, MutualFundsService, FundamentalsService],
})
export class AppModule {}
