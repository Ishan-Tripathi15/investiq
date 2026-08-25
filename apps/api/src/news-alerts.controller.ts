import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { NewsAlertsService } from './news-alerts.service';
import { NewsAlertKind } from './news-alerts.types';

@Controller('news/alerts')
@UseGuards(AuthGuard)
export class NewsAlertsController {
  constructor(private readonly service: NewsAlertsService) {}

  @Get()
  list(@Query('symbol') symbol?: string) {
    return { alerts: this.service.list(symbol) };
  }

  @Post()
  create(@Body() body: { symbol?: string; kind?: NewsAlertKind }) {
    return this.service.create(body.symbol ?? '', body.kind ?? 'any');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
