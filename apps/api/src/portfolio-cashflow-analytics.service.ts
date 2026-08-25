import { Injectable } from '@nestjs/common';

type Observation = { date: string; value: number; netCashFlow?: number };

@Injectable()
export class PortfolioCashflowAnalyticsService {
  moneyWeightedReturn(observations: Observation[]): number | null {
    if (observations.length < 2) return null;
    const points = [...observations].sort((a, b) => a.date.localeCompare(b.date));
    const start = new Date(points[0].date).getTime();
    const end = new Date(points.at(-1)!.date).getTime();
    const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
    if (!(years > 0)) return null;
    const netInvested = points.reduce((sum, p) => sum + (p.netCashFlow ?? 0), 0);
    const ending = points.at(-1)!.value;
    if (!(netInvested > 0) || !(ending > 0)) return null;
    return Math.pow(ending / netInvested, 1 / years) - 1;
  }

  totalNetCashFlow(observations: Observation[]): number | null {
    if (!observations.length) return null;
    return observations.reduce((sum, point) => sum + (point.netCashFlow ?? 0), 0);
  }
}
