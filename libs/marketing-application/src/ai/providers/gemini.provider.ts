import { AiProviderName, AiProviderError, type AiGenerateTextInput, type AiGenerateTextResult } from './ai-provider.types';
import { BaseHttpAiProvider } from './base-http-ai.provider';

export class GeminiProvider extends BaseHttpAiProvider {
  readonly name = AiProviderName.GEMINI;
  protected readonly defaultModel = process.env.AI_MODEL || 'gemini-1.5-flash';
  protected apiKey(): string | undefined { return process.env.GEMINI_API_KEY; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const contents = input.messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: `${message.role.toUpperCase()}: ${message.content}` }] }));
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: input.temperature ?? 0.2, maxOutputTokens: input.maxTokens } }),
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) throw new AiProviderError('AI_PROVIDER_REQUEST_FAILED', `Gemini request failed with ${response.status}`, raw);
    return { provider: this.name, model, content: raw.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? '', rawResponse: raw, finishReason: raw.candidates?.[0]?.finishReason };
  }
}
