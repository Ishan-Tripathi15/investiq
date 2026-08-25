import { BadRequestException, Injectable } from '@nestjs/common';
import { MutualFundsService } from './mutual-funds.service';
import { MutualFundWatchlistRepository } from './mutual-fund-watchlist.repository';

@Injectable()
export class MutualFundWatchlistService {
  constructor(private readonly repository: MutualFundWatchlistRepository, private readonly funds: MutualFundsService) {}
  async list(userId: string) { const items = await this.repository.list(userId); const details = await Promise.all(items.map(async item => { const detail = await this.funds.detail(item.schemeCode); return { ...item, schemeName: detail.scheme?.schemeName, nav: detail.scheme?.nav, navDate: detail.scheme?.date, category: detail.scheme?.category, source: detail.source }; })); return { available: true, items: details }; }
  async add(userId: string, rawSchemeCode: string) { const schemeCode = rawSchemeCode.trim(); if (!/^\d+$/.test(schemeCode)) throw new BadRequestException('Invalid mutual-fund scheme code'); const detail = await this.funds.detail(schemeCode); if (!detail.scheme) throw new BadRequestException('Mutual-fund scheme was not found in the verified provider universe'); return this.repository.add(userId, schemeCode); }
  async remove(userId: string, rawSchemeCode: string) { const schemeCode = rawSchemeCode.trim(); if (!/^\d+$/.test(schemeCode)) throw new BadRequestException('Invalid mutual-fund scheme code'); await this.repository.remove(userId, schemeCode); return { schemeCode, removed: true }; }
}
