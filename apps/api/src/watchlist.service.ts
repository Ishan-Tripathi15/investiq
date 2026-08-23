import { BadRequestException, Injectable } from '@nestjs/common';
import { WatchlistRepository } from './watchlist.repository';
import { MarketDataService } from './market-data.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly repository: WatchlistRepository, private readonly marketData: MarketDataService) {}
  async list(userId: string) { return this.repository.list(userId); }
  async add(userId: string, rawSymbol: string) {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,32}$/.test(symbol)) throw new BadRequestException('Invalid stock symbol');
    const instruments = await this.marketData.searchInstruments(symbol, 20);
    const exact = instruments.find(item => item.symbol.toUpperCase() === symbol);
    if (!exact) throw new BadRequestException('Instrument was not found in the verified market universe');
    return this.repository.add(userId, symbol);
  }
  async remove(userId: string, rawSymbol: string) {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) throw new BadRequestException('Symbol is required');
    await this.repository.remove(userId, symbol);
    return { symbol, removed: true };
  }
}
