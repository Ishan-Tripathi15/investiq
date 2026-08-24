import { Controller, Get, Query } from '@nestjs/common';
import { MutualFundsService } from './mutual-funds.service';

@Controller('mutual-funds')
export class MutualFundsController {
  constructor(private readonly service: MutualFundsService) {}

  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.service.search(q.trim(), Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }
}
