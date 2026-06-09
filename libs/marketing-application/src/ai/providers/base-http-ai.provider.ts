import { AiProviderError, type AiGenerateJsonInput, type AiGenerateJsonResult, type AiGenerateTextInput, type AiGenerateTextResult, type AiProvider } from './ai-provider.types';

export abstract class BaseHttpAiProvider implements AiProvider {
  abstract readonly name: AiProvider['name'];
  protected abstract readonly defaultModel: string;
  protected abstract apiKey(): string | undefined;
  abstract generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult>;

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  async generateJson<T = unknown>(input: AiGenerateJsonInput): Promise<AiGenerateJsonResult<T>> {
    const result = await this.generateText({ ...input, responseFormat: 'json' });
    try {
      return {
        provider: result.provider,
        model: result.model,
        data: JSON.parse(result.content) as T,
        rawContent: result.content,
        rawResponse: result.rawResponse,
        usage: result.usage,
      };
    } catch (error) {
      throw new AiProviderError('AI_OUTPUT_PARSE_ERROR', `AI provider returned invalid JSON for ${input.schemaName ?? 'schema'}`, error);
    }
  }

  protected assertConfigured(): string {
    const key = this.apiKey();
    if (!key) throw new AiProviderError('AI_PROVIDER_NOT_CONFIGURED', `${this.name} provider is not configured`);
    return key;
  }
}
