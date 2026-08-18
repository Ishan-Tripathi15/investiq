import { Controller, Get, Param } from '@nestjs/common';
import { FundamentalsService } from './fundamentals.service';

@Controller('market-data')
export class FundamentalsController {
  constructor(private readonly service: FundamentalsService) {}

  @Get('stocks/:symbol/fundamentals')
  fundamentals(@Param('symbol') symbol: string) {
    return this.service.get(symbol);
  }

  @Get('fundamentals/status')
  async status() {
    const health = await this.service.getProvider().health();
    return { provider: this.service.getProvider().name, ...health };
  }
}
