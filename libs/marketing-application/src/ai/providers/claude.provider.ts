import { AiProviderName, AiProviderError, type AiGenerateTextInput, type AiGenerateTextResult } from './ai-provider.types';
import { postProviderJson } from './ai-http.util';
import { BaseHttpAiProvider } from './base-http-ai.provider';

type ClaudeResponse = {
  content?: Array<{ text?: string }>;
  usage?: AiGenerateTextResult['usage'];
  stop_reason?: string;
};

export class ClaudeProvider extends BaseHttpAiProvider {
  readonly name = AiProviderName.CLAUDE;
  protected readonly defaultModel = process.env.AI_MODEL || 'claude-3-5-sonnet-latest';
  protected apiKey(): string | undefined { return process.env.ANTHROPIC_API_KEY; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const system = input.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const messages = input.messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role, content: message.content }));
    const { status, data: raw } = await postProviderJson<ClaudeResponse>('https://api.anthropic.com/v1/messages', {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }, { model, system, messages, temperature: input.temperature ?? 0.2, max_tokens: input.maxTokens ?? 1200 });
    if (status < 200 || status >= 300) throw new AiProviderError('AI_PROVIDER_REQUEST_FAILED', `Claude request failed with ${status}`, raw, status);
    return { provider: this.name, model, content: raw.content?.map((part) => part.text ?? '').join('') ?? '', rawResponse: raw, usage: raw.usage, finishReason: raw.stop_reason };
  }
}
