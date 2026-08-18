import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'investiq-api', version: 'v1' };
  }
}

@Module({ controllers: [HealthController] })
export class AppModule {}
