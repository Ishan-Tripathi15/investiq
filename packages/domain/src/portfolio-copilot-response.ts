import type { PortfolioCopilotContext } from './portfolio-copilot';

export type PortfolioCopilotConfidence = 'low' | 'medium' | 'high';

export interface PortfolioCopilotResponse {
  answer: string;
  confidence: PortfolioCopilotConfidence;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  evidenceIds: string[];
  limitations: string[];
  requiresHumanReview: boolean;
}

const EXECUTION_PATTERNS = [
  /\b(place|submit|execute|send|cancel|modify)\s+(a\s+)?(buy|sell|order|trade)/i,
  /\b(buy|sell)\s+now\b/i,
  /\bexecute\s+this\b/i,
];

const EVIDENCE_ID_PATTERN = /\[([a-z0-9:_-]+)\]/gi;

function cleanText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  if (value.length > 6000) throw new Error(`${field} is too long`);
  return value.trim();
}

function validateEvidenceIds(answer: string, context: PortfolioCopilotContext): string[] {
  const available = new Set(context.evidence.map((item) => item.id));
  const ids = [...answer.matchAll(EVIDENCE_ID_PATTERN)]
    .map((match) => match[1])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (!ids.length) throw new Error('Copilot answer must cite at least one evidence identifier');
  const unique = [...new Set(ids)];
  const unsupported = unique.filter((id) => !available.has(id));
  if (unsupported.length) throw new Error(`Copilot cited unsupported evidence: ${unsupported.join(', ')}`);
  return unique;
}

function rejectUnsupportedNumericClaims(answer: string): void {
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    if (/\b\d+(?:\.\d+)?\s*%?|₹\s*\d|\b\d+(?:\.\d+)?x\b/i.test(sentence) && !EVIDENCE_ID_PATTERN.test(sentence)) {
      throw new Error('Numeric claims must cite evidence in the same sentence');
    }
    EVIDENCE_ID_PATTERN.lastIndex = 0;
  }
}

export function validatePortfolioCopilotResponse(
  input: unknown,
  context: PortfolioCopilotContext,
): PortfolioCopilotResponse {
  if (!input || typeof input !== 'object') throw new Error('Invalid copilot response');
  const value = input as Record<string, unknown>;
  const answer = cleanText(value.answer, 'answer');
  const confidence = value.confidence;
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') throw new Error('Invalid confidence');
  const riskLevel = value.riskLevel;
  if (!['low', 'moderate', 'high', 'critical', 'unknown'].includes(String(riskLevel))) throw new Error('Invalid risk level');
  if (EXECUTION_PATTERNS.some((pattern) => pattern.test(answer))) throw new Error('Copilot response contains a trade execution instruction');

  const evidenceIds = validateEvidenceIds(answer, context);
  rejectUnsupportedNumericClaims(answer);

  if (context.answerability === 'insufficient_data' && confidence === 'high') {
    throw new Error('High confidence is not allowed when portfolio data is insufficient');
  }
  if (context.answerability === 'insufficient_data' && !/insufficient|missing|unavailable|cannot|not enough/i.test(answer)) {
    throw new Error('Insufficient-data responses must disclose the limitation');
  }

  const limitations = Array.isArray(value.limitations)
    ? value.limitations.filter((item): item is string => typeof item === 'string').slice(0, 10)
    : [];
  const mergedLimitations = [...new Set([...context.limitations, ...limitations])].slice(0, 10);

  return {
    answer,
    confidence,
    riskLevel: riskLevel as PortfolioCopilotResponse['riskLevel'],
    evidenceIds,
    limitations: mergedLimitations,
    requiresHumanReview: Boolean(value.requiresHumanReview) || context.answerability === 'insufficient_data' || confidence === 'low',
  };
}
