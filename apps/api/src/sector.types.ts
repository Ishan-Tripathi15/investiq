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

export interface PortfolioSectorExposure {
  sector: string;
  marketValue: number;
  weightPercent: number;
  holdings: number;
}

export interface PortfolioSectorExposureResponse {
  available: boolean;
  totalMarketValue: number;
  classifiedMarketValue: number;
  unclassifiedMarketValue: number;
  classifiedCoveragePercent: number;
  sectors: PortfolioSectorExposure[];
  source: MarketSource | null;
  message?: string;
}
