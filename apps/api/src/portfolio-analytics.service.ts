import { Injectable } from '@nestjs/common';

type Observation = { date: string; value: number };

@Injectable()
export class PortfolioAnalyticsService {
  private validObservations(observations: Observation[]): Observation[] {
    return observations
      .filter((point) => Number.isFinite(point.value) && Number.isFinite(new Date(point.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  timeWeightedReturn(observations: Observation[]): number | null {
    const ordered = this.validObservations(observations);
    if (ordered.length < 2) return null;
    const first = ordered[0].value;
    const last = ordered[ordered.length - 1].value;
    if (!(first > 0) || !Number.isFinite(last)) return null;
    return last / first - 1;
  }

  maxDrawdown(observations: Observation[]): number | null {
    const ordered = this.validObservations(observations);
    if (ordered.length < 2 || !(ordered[0].value > 0)) return null;
    let peak = ordered[0].value;
    let worst = 0;
    for (const point of ordered) {
      if (point.value > peak) peak = point.value;
      if (peak > 0) worst = Math.min(worst, point.value / peak - 1);
    }
    return worst;
  }

  annualizedReturn(observations: Observation[]): number | null {
    const ordered = this.validObservations(observations);
    if (ordered.length < 2) return null;
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (!(first.value > 0) || !(last.value > 0)) return null;
    const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (!(years > 0)) return null;
    return Math.pow(last.value / first.value, 1 / years) - 1;
  }
}
