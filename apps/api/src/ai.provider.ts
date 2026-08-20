import type { AiAnalysisContext, AiAnalysisResult } from '@investiq/domain';
import { validateAiAnalysis } from '@investiq/domain';

export interface AiProviderHealth {
  configured: boolean;
  provider: string;
  model?: string;
  message: string;
}

export interface AiProvider {
  health(): AiProviderHealth;
  analyze(context: AiAnalysisContext): Promise<AiAnalysisResult>;
}

class UnconfiguredAiProvider implements AiProvider {
  health(): AiProviderHealth {
    return { configured: false, provider: 'unconfigured', message: 'AI provider credentials are not configured.' };
  }

  async analyze(_context: AiAnalysisContext): Promise<AiAnalysisResult> {
    throw new Error('AI provider is not configured');
  }
}

class HttpAiProvider implements AiProvider {
  private readonly url = process.env.AI_API_URL!.trim();
  private readonly apiKey = process.env.AI_API_KEY!.trim();
  private readonly model = (process.env.AI_MODEL ?? '').trim();

  health(): AiProviderHealth {
    return { configured: true, provider: 'http-structured', model: this.model || undefined, message: 'AI provider is configured.' };
  }

  async analyze(context: AiAnalysisContext): Promise<AiAnalysisResult> {
    if (!this.model) throw new Error('AI_MODEL is required');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
        keySignals: { type: 'array', items: { type: 'string' } },
        riskFactors: { type: 'array', items: { type: 'string' } },
        assumptions: { type: 'array', items: { type: 'string' } },
        invalidationConditions: { type: 'array', items: { type: 'string' } },
        citedFeatures: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'confidence', 'riskLevel', 'keySignals', 'riskFactors', 'assumptions', 'invalidationConditions', 'citedFeatures'],
    };

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You are InvestIQ financial intelligence. Use only the supplied verified observations. Never invent prices, returns, financial metrics, news, or portfolio facts. Clearly separate historical observations from scenarios. Do not give guaranteed returns or personalized regulated financial advice. Return only the requested structured object.',
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'investiq_analysis', strict: true, schema } },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    const choices = payload.choices as Array<Record<string, unknown>> | undefined;
    const content = choices?.[0]?.message && typeof choices[0].message === 'object'
      ? (choices[0].message as Record<string, unknown>).content
      : undefined;
    if (typeof content !== 'string') throw new Error('AI provider returned no structured content');

    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new Error('AI provider returned invalid JSON'); }
    return validateAiAnalysis(parsed, context);
  }
}

export function createAiProvider(): AiProvider {
  if (process.env.AI_API_URL?.trim() && process.env.AI_API_KEY?.trim()) return new HttpAiProvider();
  return new UnconfiguredAiProvider();
}
