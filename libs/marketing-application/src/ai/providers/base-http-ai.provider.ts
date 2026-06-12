import { AiDebugLoggerService } from '../debug';
import { AiProviderError, type AiGenerateJsonInput, type AiGenerateJsonResult, type AiGenerateTextInput, type AiGenerateTextResult, type AiProvider } from './ai-provider.types';

export abstract class BaseHttpAiProvider implements AiProvider {
  constructor(protected readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService()) {}
  abstract readonly name: AiProvider['name'];
  protected abstract readonly defaultModel: string;
  protected abstract apiKey(): string | undefined;
  abstract generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult>;

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  async generateJson<T = unknown>(input: AiGenerateJsonInput): Promise<AiGenerateJsonResult<T>> {
    const meta = { ...(input.metadata ?? {}), aiFlow: (input.metadata as any)?.aiFlow ?? 'recommendation', promptType: (input.metadata as any)?.promptType ?? 'RECOMMENDATION', model: input.model };
    const result = await this.generateText({ ...input, responseFormat: 'json' });
    this.debugLogger.logResponseParsingStarted(meta as any, input.schemaName);
    try {
      const data = JSON.parse(result.content) as T;
      this.debugLogger.logResponseParsed({ ...(meta as any), model: result.model }, { outputType: input.schemaName, itemsCount: Array.isArray((data as any)?.recommendations) ? (data as any).recommendations.length : undefined, valid: true, parsedOutput: data });
      return {
        provider: result.provider,
        model: result.model,
        data,
        rawContent: result.content,
        rawResponse: result.rawResponse,
        usage: result.usage,
      };
    } catch (error) {
      this.debugLogger.logResponseParsingFailed({ ...(meta as any), model: result.model }, error, result.content);
      throw new AiProviderError('AI_OUTPUT_PARSE_ERROR', `AI provider returned invalid JSON for ${input.schemaName ?? 'schema'}`, error);
    }
  }

  protected assertConfigured(): string {
    const key = this.apiKey();
    if (!key) throw new AiProviderError('AI_PROVIDER_NOT_CONFIGURED', `${this.name} provider is not configured`);
    return key;
  }
}
