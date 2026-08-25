import { Injectable } from '@nestjs/common';

type Observation = { date: string; value: number };

@Injectable()
export class PortfolioAnalyticsService {
  timeWeightedReturn(observations: Observation[]): number | null {
    if (observations.length < 2) return null;
    const ordered = [...observations].sort((a, b) => a.date.localeCompare(b.date));
    const first = ordered[0].value;
    const last = ordered[ordered.length - 1].value;
    if (!(first > 0) || !Number.isFinite(last)) return null;
    return last / first - 1;
  }

  maxDrawdown(observations: Observation[]): number | null {
    if (observations.length < 2) return null;
    const ordered = [...observations].sort((a, b) => a.date.localeCompare(b.date));
    let peak = ordered[0].value;
    let worst = 0;
    for (const point of ordered) {
      if (point.value > peak) peak = point.value;
      if (peak > 0) worst = Math.min(worst, point.value / peak - 1);
    }
    return worst;
  }

  annualizedReturn(observations: Observation[]): number | null {
    if (observations.length < 2) return null;
    const ordered = [...observations].sort((a, b) => a.date.localeCompare(b.date));
    const start = new Date(ordered[0].date).getTime();
    const end = new Date(ordered[ordered.length - 1].date).getTime();
    const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
    if (!(years > 0) || !(ordered[0].value > 0) || !(ordered.at(-1)?.value)) return null;
    return Math.pow(ordered.at(-1)!.value / ordered[0].value, 1 / years) - 1;
  }
}
