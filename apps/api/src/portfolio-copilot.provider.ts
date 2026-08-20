import type { PortfolioCopilotContext, PortfolioCopilotResponse } from '@investiq/domain';
import { validatePortfolioCopilotResponse } from '@investiq/domain';

export interface PortfolioCopilotProviderHealth {
  configured: boolean;
  provider: string;
  model?: string;
  message: string;
}

export interface PortfolioCopilotProvider {
  health(): PortfolioCopilotProviderHealth;
  answer(context: PortfolioCopilotContext): Promise<PortfolioCopilotResponse>;
}

class UnconfiguredPortfolioCopilotProvider implements PortfolioCopilotProvider {
  health(): PortfolioCopilotProviderHealth {
    return { configured: false, provider: 'unconfigured', message: 'AI provider credentials are not configured.' };
  }

  async answer(_context: PortfolioCopilotContext): Promise<PortfolioCopilotResponse> {
    throw new Error('AI provider is not configured');
  }
}

class HttpPortfolioCopilotProvider implements PortfolioCopilotProvider {
  private readonly url = process.env.AI_API_URL!.trim();
  private readonly apiKey = process.env.AI_API_KEY!.trim();
  private readonly model = (process.env.AI_MODEL ?? '').trim();

  health(): PortfolioCopilotProviderHealth {
    return { configured: true, provider: 'http-structured', model: this.model || undefined, message: 'AI provider is configured.' };
  }

  async answer(context: PortfolioCopilotContext): Promise<PortfolioCopilotResponse> {
    if (!this.model) throw new Error('AI_MODEL is required');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        answer: { type: 'string' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        riskLevel: { type: 'string', enum: ['low', 'moderate', 'high', 'critical', 'unknown'] },
        limitations: { type: 'array', items: { type: 'string' } },
        requiresHumanReview: { type: 'boolean' },
      },
      required: ['answer', 'confidence', 'riskLevel', 'limitations', 'requiresHumanReview'],
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
            content: [
              'You are the InvestIQ portfolio copilot.',
              ...context.systemInstructions,
              'Every factual or numeric claim must cite one or more supplied evidence identifiers in square brackets, such as [cash-pct].',
              'Never create an evidence identifier.',
              'Never issue a trade execution instruction or tell the user to buy or sell now.',
              'If the evidence cannot answer the question, explicitly say the data is insufficient.',
              'Return only the requested structured object.',
            ].join(' '),
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'investiq_portfolio_copilot', strict: true, schema } },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    const choices = payload.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (typeof content !== 'string') throw new Error('AI provider returned no structured content');

    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new Error('AI provider returned invalid JSON'); }
    return validatePortfolioCopilotResponse(parsed, context);
  }
}

export function createPortfolioCopilotProvider(): PortfolioCopilotProvider {
  if (process.env.AI_API_URL?.trim() && process.env.AI_API_KEY?.trim()) return new HttpPortfolioCopilotProvider();
  return new UnconfiguredPortfolioCopilotProvider();
}
