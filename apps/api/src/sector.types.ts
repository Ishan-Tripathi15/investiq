import { MarketSource } from './market-data.types';

export interface SectorSnapshot {
  id: string;
  name: string;
  performancePercent?: number;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
  source: MarketSource | null;
}

export interface SectorOverviewResponse {
  available: boolean;
  sectors: SectorSnapshot[];
  strongest: SectorSnapshot | null;
  weakest: SectorSnapshot | null;
  source: MarketSource | null;
  message?: string;
}
