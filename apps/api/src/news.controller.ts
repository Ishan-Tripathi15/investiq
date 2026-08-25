import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { NewsService } from './news.service';

function parseLimit(limit?: string): number {
  const parsedLimit = limit == null ? 20 : Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    throw new BadRequestException('limit must be an integer between 1 and 50');
  }
  return parsedLimit;
}

function normalizeQuery(query?: string): string | undefined {
  const normalizedQuery = query?.trim() || undefined;
  if (normalizedQuery && normalizedQuery.length > 100) throw new BadRequestException('q must be 100 characters or fewer');
  return normalizedQuery;
}

@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async latest(@Query('q') query?: string, @Query('limit') limit?: string) {
    return this.news.latest(normalizeQuery(query), parseLimit(limit));
  }

  @Get('stock/:symbol')
  async stock(@Param('symbol') symbol: string, @Query('limit') limit?: string) {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(normalizedSymbol)) {
      throw new BadRequestException('symbol must contain only letters, numbers, dots or hyphens and be at most 20 characters');
    }
    return this.news.stock(normalizedSymbol, parseLimit(limit));
  }
}
