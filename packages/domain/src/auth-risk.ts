export type AuthRiskDecision = 'allow' | 'step_up' | 'block';

export interface AuthRiskInput {
  hasKnownDevice: boolean;
  hasKnownIp: boolean;
  hasMfa: boolean;
  failedAttempts: number;
  isPasswordResetFlow?: boolean;
  isSensitiveAction?: boolean;
}

export interface AuthRiskResult {
  decision: AuthRiskDecision;
  score: number;
  reasons: string[];
}

export function evaluateAuthRisk(input: AuthRiskInput): AuthRiskResult {
  const reasons: string[] = [];
  let score = 0;

  if (!input.hasKnownDevice) {
    score += 35;
    reasons.push('new_device');
  }
  if (!input.hasKnownIp) {
    score += 20;
    reasons.push('new_network');
  }
  if (input.failedAttempts >= 3) {
    score += 30;
    reasons.push('repeated_failures');
  } else if (input.failedAttempts > 0) {
    score += 10;
    reasons.push('previous_failure');
  }
  if (input.isPasswordResetFlow) {
    score += 35;
    reasons.push('account_recovery');
  }
  if (input.isSensitiveAction) {
    score += 30;
    reasons.push('sensitive_action');
  }

  if (score >= 80) return { decision: 'block', score, reasons };
  if (score >= 35 || !input.hasMfa) return { decision: 'step_up', score, reasons: [...reasons, ...(!input.hasMfa ? ['mfa_not_enabled'] : [])] };
  return { decision: 'allow', score, reasons };
}
