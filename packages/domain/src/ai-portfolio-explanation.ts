import type { PortfolioIntelligence } from './portfolio-intelligence';
import type { RiskTwinSummary } from './ai-risk-twin';

export interface PortfolioExplanationEvidence {
  code: string;
  label: string;
  value?: number;
  unit?: string;
  interpretation: string;
}

export interface PortfolioExplanation {
  headline: string;
  riskLevel: PortfolioIntelligence['riskLevel'];
  summary: string;
  evidence: PortfolioExplanationEvidence[];
  warnings: string[];
  actions: string[];
  scenarioHighlights: Array<{
    scenario: string;
    lossPct: number;
    portfolioValueAfter: number;
    breachedDailyLimit: boolean;
    breachedDrawdownLimit: boolean;
  }>;
  disclaimer: string;
}

function pct(value: number): string { return `${value.toFixed(1)}%`; }

export function buildPortfolioExplanation(
  intelligence: PortfolioIntelligence,
  riskTwin: RiskTwinSummary,
): PortfolioExplanation {
  const evidence: PortfolioExplanationEvidence[] = [];
  const warnings = [...intelligence.warnings, ...riskTwin.warnings];

  if (intelligence.largestPosition) {
    evidence.push({
      code: 'largest_position',
      label: 'Largest position',
      value: intelligence.largestPosition.weightPct,
      unit: '% of equity',
      interpretation: `${intelligence.largestPosition.symbol} represents ${pct(intelligence.largestPosition.weightPct)} of equity.`,
    });
  }

  evidence.push({
    code: 'cash_buffer',
    label: 'Cash buffer',
    value: intelligence.cashPct,
    unit: '% of equity',
    interpretation: `${pct(intelligence.cashPct)} of equity is held as cash.`,
  });

  if (intelligence.betaWeighted !== undefined) {
    evidence.push({
      code: 'portfolio_beta',
      label: 'Weighted beta',
      value: intelligence.betaWeighted,
      interpretation: `The supplied holdings imply a weighted beta of ${intelligence.betaWeighted.toFixed(2)}.`,
    });
  }

  const largestSector = intelligence.sectorExposure[0];
  if (largestSector) {
    evidence.push({
      code: 'largest_sector',
      label: 'Largest sector',
      value: largestSector.weightPct,
      unit: '% of equity',
      interpretation: `${largestSector.sector} accounts for ${pct(largestSector.weightPct)} of equity from the supplied sector classifications.`,
    });
  }

  const breached = riskTwin.scenarios.filter((scenario) => scenario.breachedDailyLimit || scenario.breachedDrawdownLimit);
  const highestLoss = riskTwin.scenarios.reduce((best, scenario) => !best || scenario.lossPct > best.lossPct ? scenario : best, undefined as RiskTwinSummary['scenarios'][number] | undefined);

  let headline = 'Portfolio risk is within the current deterministic thresholds.';
  if (intelligence.riskLevel === 'critical') headline = 'Portfolio risk is critical and needs immediate review.';
  else if (intelligence.riskLevel === 'high') headline = 'Portfolio risk is elevated and deserves review.';
  else if (intelligence.riskLevel === 'moderate') headline = 'Portfolio has moderate concentration or liquidity risk.';

  const summaryParts = [
    `Risk level: ${intelligence.riskLevel}.`,
    `Largest-position concentration is ${pct(intelligence.concentrationPct)}.`,
    `Cash is ${pct(intelligence.cashPct)} of equity.`,
  ];
  if (breached.length) summaryParts.push(`${breached.length} stress scenarios breach at least one configured risk threshold.`);
  if (highestLoss) summaryParts.push(`The most severe configured stress leaves ${pct(100 - highestLoss.lossPct)} of equity, before any real-world execution or liquidity effects.`);

  return {
    headline,
    riskLevel: intelligence.riskLevel,
    summary: summaryParts.join(' '),
    evidence,
    warnings,
    actions: [...new Set([...intelligence.actions, ...riskTwin.warnings.map((warning) => `Review: ${warning}`)])],
    scenarioHighlights: riskTwin.scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      lossPct: scenario.lossPct,
      portfolioValueAfter: scenario.portfolioValueAfter,
      breachedDailyLimit: scenario.breachedDailyLimit,
      breachedDrawdownLimit: scenario.breachedDrawdownLimit,
    })),
    disclaimer: 'This is a deterministic portfolio-risk explanation based only on supplied verified account and position data. Stress scenarios are not forecasts, guarantees, or personalized financial advice.',
  };
}
