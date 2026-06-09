import { AiProviderName, AiProviderError, type AiGenerateTextInput, type AiGenerateTextResult } from './ai-provider.types';
import { BaseHttpAiProvider } from './base-http-ai.provider';

export class OpenAiProvider extends BaseHttpAiProvider {
  readonly name = AiProviderName.OPENAI;
  protected readonly defaultModel = process.env.AI_MODEL || 'gpt-4o-mini';
  protected apiKey(): string | undefined { return process.env.OPENAI_API_KEY; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: input.messages, temperature: input.temperature ?? 0.2, max_tokens: input.maxTokens, response_format: input.responseFormat === 'json' ? { type: 'json_object' } : undefined }),
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) throw new AiProviderError('AI_PROVIDER_REQUEST_FAILED', `OpenAI request failed with ${response.status}`, raw);
    return { provider: this.name, model, content: raw.choices?.[0]?.message?.content ?? '', rawResponse: raw, usage: raw.usage, finishReason: raw.choices?.[0]?.finish_reason };
  }
}
