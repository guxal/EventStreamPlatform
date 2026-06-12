import { AiDebugLoggerService } from '../debug';
import {
  AiProviderName,
  AiProviderError,
  type AiGenerateTextInput,
  type AiGenerateTextResult,
} from './ai-provider.types';
import { postProviderJson } from './ai-http.util';
import { BaseHttpAiProvider } from './base-http-ai.provider';

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export class OpenAiProvider extends BaseHttpAiProvider {
  constructor(debugLogger: AiDebugLoggerService = new AiDebugLoggerService()) {
    super(debugLogger);
  }
  readonly name = AiProviderName.OPENAI;
  protected readonly defaultModel = process.env.AI_MODEL || 'gpt-4o-mini';
  protected apiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  }

  async generateText(
    input: AiGenerateTextInput,
  ): Promise<AiGenerateTextResult> {
    const started = Date.now();
    const apiKey = this.assertConfigured();
    const model = input.model || this.defaultModel;
    const temperature = input.temperature ?? 0.2;
    const maxTokens =
      input.maxTokens ?? Number(process.env.AI_MAX_TOKENS ?? 1200);
    const meta = { ...(input.metadata ?? {}), model, temperature, maxTokens };
    const forbidden = this.debugLogger.forbiddenRawDataPaths(input.messages);
    if (forbidden.length > 0) {
      this.debugLogger.logContextRejected(
        meta as any,
        'Forbidden raw data keys found in OpenAI prompt',
        forbidden,
      );
      throw new AiProviderError(
        'AI_CONTEXT_EMPTY',
        `OpenAI prompt rejected because it contains forbidden raw data keys: ${forbidden.join(', ')}`,
      );
    }
    this.debugLogger.logOpenAiRequestStarted(meta as any, {
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60000),
      messagesCount: input.messages.length,
    });
    try {
      const { status, data: raw } = await postProviderJson<OpenAiResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        {
          model,
          messages: input.messages,
          temperature,
          max_tokens: maxTokens,
          response_format:
            input.responseFormat === 'json'
              ? { type: 'json_object' }
              : undefined,
        },
      );
      if (status < 200 || status >= 300)
        throw new AiProviderError(
          'AI_PROVIDER_REQUEST_FAILED',
          `OpenAI request failed with ${status}`,
          sanitizeOpenAiError(raw),
        );
      const content = raw.choices?.[0]?.message?.content ?? '';
      this.debugLogger.logOpenAiResponseReceived(meta as any, {
        durationMs: Date.now() - started,
        finishReason: raw.choices?.[0]?.finish_reason,
        inputTokens: raw.usage?.prompt_tokens,
        outputTokens: raw.usage?.completion_tokens,
        totalTokens: raw.usage?.total_tokens,
        responseChars: content.length,
        responseContent: content,
      });
      return {
        provider: this.name,
        model,
        content,
        rawResponse: raw,
        usage: raw.usage
          ? {
              promptTokens: raw.usage.prompt_tokens,
              completionTokens: raw.usage.completion_tokens,
              totalTokens: raw.usage.total_tokens,
            }
          : undefined,
        finishReason: raw.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      this.debugLogger.logOpenAiError(meta as any, {
        durationMs: Date.now() - started,
        errorType: classifyOpenAiError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: isRetryableOpenAiError(error),
      });
      throw error;
    }
  }
}

function sanitizeOpenAiError(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const clone = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  delete clone.api_key;
  delete clone.authorization;
  return clone;
}

function classifyOpenAiError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('rate') || message.includes('429')) return 'rate_limit';
  if (
    message.includes('api key') ||
    message.includes('401') ||
    message.includes('invalid_api_key')
  )
    return 'invalid_api_key';
  if (message.includes('model') || message.includes('404'))
    return 'model_not_found';
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econn')
  )
    return 'network';
  return 'unknown';
}

function isRetryableOpenAiError(error: unknown): boolean {
  return ['timeout', 'rate_limit', 'network', 'unknown'].includes(
    classifyOpenAiError(error),
  );
}
