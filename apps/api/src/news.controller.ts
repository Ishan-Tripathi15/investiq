import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async latest(@Query('q') query?: string, @Query('limit') limit?: string) {
    const normalizedQuery = query?.trim() || undefined;
    if (normalizedQuery && normalizedQuery.length > 100) throw new BadRequestException('q must be 100 characters or fewer');

    const parsedLimit = limit == null ? 20 : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      throw new BadRequestException('limit must be an integer between 1 and 50');
    }

    return this.news.latest(normalizedQuery, parsedLimit);
  }
}
