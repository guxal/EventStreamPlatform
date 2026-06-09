import { AiProviderName, AiProviderError, type AiGenerateTextInput, type AiGenerateTextResult } from './ai-provider.types';
import { BaseHttpAiProvider } from './base-http-ai.provider';

export class ClaudeProvider extends BaseHttpAiProvider {
  readonly name = AiProviderName.CLAUDE;
  protected readonly defaultModel = process.env.AI_MODEL || 'claude-3-5-sonnet-latest';
  protected apiKey(): string | undefined { return process.env.ANTHROPIC_API_KEY; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const system = input.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const messages = input.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role, content: message.content }));
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, messages, temperature: input.temperature ?? 0.2, max_tokens: input.maxTokens ?? 1200 }),
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) throw new AiProviderError('AI_PROVIDER_REQUEST_FAILED', `Claude request failed with ${response.status}`, raw);
    return { provider: this.name, model, content: raw.content?.map((part: { text?: string }) => part.text ?? '').join('') ?? '', rawResponse: raw, usage: raw.usage, finishReason: raw.stop_reason };
  }
}
