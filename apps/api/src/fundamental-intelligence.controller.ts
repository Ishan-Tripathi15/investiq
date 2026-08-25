import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { FundamentalIntelligenceService } from './fundamental-intelligence.service';

@Controller('market-data')
@UseGuards(AuthGuard)
export class FundamentalIntelligenceController {
  constructor(private readonly service: FundamentalIntelligenceService) {}

  @Get('stocks/:symbol/intelligence')
  intelligence(@Param('symbol') symbol: string) {
    return this.service.get(symbol);
  }
}
