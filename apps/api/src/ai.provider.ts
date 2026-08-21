import type { AiAnalysisContext, AiAnalysisResult, PortfolioCopilotContext, PortfolioCopilotResponse } from '@investiq/domain';
import { validateAiAnalysis, validatePortfolioCopilotResponse } from '@investiq/domain';

export interface AiProviderHealth {
  configured: boolean;
  provider: string;
  model?: string;
  message: string;
}

export interface AiProvider {
  health(): AiProviderHealth;
  analyze(context: AiAnalysisContext): Promise<AiAnalysisResult>;
  copilot(context: PortfolioCopilotContext): Promise<PortfolioCopilotResponse>;
}

class UnconfiguredAiProvider implements AiProvider {
  health(): AiProviderHealth { return { configured: false, provider: 'unconfigured', message: 'AI provider credentials are not configured.' }; }
  async analyze(_context: AiAnalysisContext): Promise<AiAnalysisResult> { throw new Error('AI provider is not configured'); }
  async copilot(_context: PortfolioCopilotContext): Promise<PortfolioCopilotResponse> { throw new Error('AI provider is not configured'); }
}

class HttpAiProvider implements AiProvider {
  private readonly url = process.env.AI_API_URL!.trim();
  private readonly apiKey = process.env.AI_API_KEY!.trim();
  private readonly model = (process.env.AI_MODEL ?? '').trim();

  health(): AiProviderHealth { return { configured: true, provider: 'http-structured', model: this.model || undefined, message: 'AI provider is configured.' }; }

  private async request(schemaName: string, schema: Record<string, unknown>, system: string, context: unknown): Promise<unknown> {
    if (!this.model) throw new Error('AI_MODEL is required');
    const response = await fetch(this.url, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, temperature: 0, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(context) }], response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    const choices = payload.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message;
    const content = message && typeof message === 'object' ? (message as Record<string, unknown>).content : undefined;
    if (typeof content !== 'string') throw new Error('AI provider returned no structured content');
    try { return JSON.parse(content); } catch { throw new Error('AI provider returned invalid JSON'); }
  }

  async analyze(context: AiAnalysisContext): Promise<AiAnalysisResult> {
    const schema = { type: 'object', additionalProperties: false, properties: { summary: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 }, riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] }, keySignals: { type: 'array', items: { type: 'string' } }, riskFactors: { type: 'array', items: { type: 'string' } }, assumptions: { type: 'array', items: { type: 'string' } }, invalidationConditions: { type: 'array', items: { type: 'string' } }, citedFeatures: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'confidence', 'riskLevel', 'keySignals', 'riskFactors', 'assumptions', 'invalidationConditions', 'citedFeatures'] };
    const parsed = await this.request('investiq_analysis', schema, 'You are InvestIQ financial intelligence. Use only supplied verified observations. Never invent prices, returns, financial metrics, news, or portfolio facts. Separate historical observations from scenarios. Do not give guaranteed returns or personalized regulated financial advice. Return only the requested structured object.', context);
    return validateAiAnalysis(parsed, context);
  }

  async copilot(context: PortfolioCopilotContext): Promise<PortfolioCopilotResponse> {
    const schema = { type: 'object', additionalProperties: false, properties: { answer: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, riskLevel: { type: 'string', enum: ['low', 'moderate', 'high', 'critical', 'unknown'] }, limitations: { type: 'array', items: { type: 'string' } }, requiresHumanReview: { type: 'boolean' } }, required: ['answer', 'confidence', 'riskLevel', 'limitations', 'requiresHumanReview'] };
    const parsed = await this.request('investiq_portfolio_copilot', schema, 'You are the InvestIQ Portfolio Copilot. Answer only from supplied portfolio evidence and reference knowledge. Every factual or numeric claim must cite an evidence identifier like [cash-pct] in the same sentence. Never invent holdings, prices, returns, transactions, news, valuations, taxes, or missing metrics. Never instruct the user to execute, cancel, modify, buy, or sell an order. Separate observed facts from deterministic stress scenarios. If data is insufficient, explicitly say what is missing and use low confidence. Return only the requested structured object.', context);
    return validatePortfolioCopilotResponse(parsed, context);
  }
}

export function createAiProvider(): AiProvider {
  if (process.env.AI_API_URL?.trim() && process.env.AI_API_KEY?.trim()) return new HttpAiProvider();
  return new UnconfiguredAiProvider();
}
