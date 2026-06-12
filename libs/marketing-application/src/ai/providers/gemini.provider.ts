import { AiProviderName, AiProviderError, type AiGenerateTextInput, type AiGenerateTextResult } from './ai-provider.types';
import { postProviderJson } from './ai-http.util';
import { BaseHttpAiProvider } from './base-http-ai.provider';

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

export class GeminiProvider extends BaseHttpAiProvider {
  readonly name = AiProviderName.GEMINI;
  protected readonly defaultModel = process.env.AI_MODEL || 'gemini-1.5-flash';
  protected apiKey(): string | undefined { return process.env.GEMINI_API_KEY; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const contents = input.messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: `${message.role.toUpperCase()}: ${message.content}` }] }));
    const { status, data: raw } = await postProviderJson<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { 'Content-Type': 'application/json' },
      { contents, generationConfig: { temperature: input.temperature ?? 0.2, maxOutputTokens: input.maxTokens } },
    );
    if (status < 200 || status >= 300) throw new AiProviderError('AI_PROVIDER_REQUEST_FAILED', `Gemini request failed with ${status}`, raw, status);
    return { provider: this.name, model, content: raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '', rawResponse: raw, finishReason: raw.candidates?.[0]?.finishReason };
  }
}
