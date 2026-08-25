import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { MutualFundIntelligenceService } from './mutual-fund-intelligence.service';

@Controller('mutual-funds')
@UseGuards(AuthGuard)
export class MutualFundIntelligenceController {
  constructor(private readonly intelligence: MutualFundIntelligenceService) {}

  @Get(':schemeId/intelligence')
  get(@Param('schemeId') schemeId: string) {
    return this.intelligence.get(schemeId);
  }
}
