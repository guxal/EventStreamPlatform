import { AiProviderName, AiProviderError, type AiGenerateTextInput, type AiGenerateTextResult } from './ai-provider.types';
import { postProviderJson } from './ai-http.util';
import { BaseHttpAiProvider } from './base-http-ai.provider';

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: AiGenerateTextResult['usage'];
};

export class OpenAiProvider extends BaseHttpAiProvider {
  readonly name = AiProviderName.OPENAI;
  protected readonly defaultModel = process.env.AI_MODEL || 'gpt-4o-mini';
  protected apiKey(): string | undefined { return process.env.OPENAI_API_KEY; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const { status, data: raw } = await postProviderJson<OpenAiResponse>('https://api.openai.com/v1/chat/completions', {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }, {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens,
      response_format: input.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });
    if (status < 200 || status >= 300) throw new AiProviderError('AI_PROVIDER_REQUEST_FAILED', `OpenAI request failed with ${status}`, raw);
    return { provider: this.name, model, content: raw.choices?.[0]?.message?.content ?? '', rawResponse: raw, usage: raw.usage, finishReason: raw.choices?.[0]?.finish_reason };
  }
}
