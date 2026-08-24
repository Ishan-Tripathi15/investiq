import { Controller, Get } from '@nestjs/common';
import { MarketOverviewService } from './market-overview.service';

@Controller('market-overview')
export class MarketOverviewController {
  constructor(private readonly service: MarketOverviewService) {}

  @Get()
  overview() { return this.service.overview(); }
}
