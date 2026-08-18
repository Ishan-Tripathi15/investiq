import { Controller, Get, Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'investiq-api', version: 'v1' };
  }
}

@Module({ controllers: [HealthController, MarketDataController] })
export class AppModule {}
