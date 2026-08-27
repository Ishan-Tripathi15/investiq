import type { PortfolioAction } from './portfolio-action-center';
import type { ProactiveAlert } from './proactive-intelligence-alerts';

export interface IntelligenceDigest {
  generatedAt: string;
  title: string;
  summary: string;
  actions: PortfolioAction[];
  alerts: ProactiveAlert[];
  criticalCount: number;
  highCount: number;
}

export function buildIntelligenceDigest(input: {
  actions: PortfolioAction[];
  alerts: ProactiveAlert[];
  generatedAt?: string;
}): IntelligenceDigest {
  const criticalCount = input.actions.filter((a) => a.severity === 'critical').length;
  const highCount = input.actions.filter((a) => a.severity === 'high').length;
  const parts: string[] = [];
  if (criticalCount) parts.push(`${criticalCount} critical action${criticalCount === 1 ? '' : 's'}`);
  if (highCount) parts.push(`${highCount} high-priority action${highCount === 1 ? '' : 's'}`);
  const summary = parts.length ? `Your portfolio needs attention: ${parts.join(' and ')}.` : 'No critical or high-priority portfolio actions require attention.';
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    title: 'InvestIQ Intelligence Digest',
    summary,
    actions: input.actions,
    alerts: input.alerts,
    criticalCount,
    highCount,
  };
}
