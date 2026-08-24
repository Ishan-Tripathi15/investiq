import { MarketSource } from './market-data.types';

export interface MarketIndex { symbol: string; name: string; value: number; change?: number; changePercent?: number; currency?: string; timestamp: string; source: MarketSource | null; }
export interface MarketMover { symbol: string; name?: string; price: number; change?: number; changePercent?: number; exchange?: string; source: MarketSource | null; }
export interface MarketOverviewResponse { available: boolean; marketOpen: boolean | null; indices: MarketIndex[]; gainers: MarketMover[]; losers: MarketMover[]; active: MarketMover[]; source: MarketSource | null; message?: string; }
