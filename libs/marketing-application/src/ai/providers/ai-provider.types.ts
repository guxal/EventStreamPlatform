export enum AiProviderName {
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
  CLAUDE = 'CLAUDE',
  MOCK = 'MOCK',
}

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiGenerateTextInput = {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: 'text' | 'json';
  metadata?: Record<string, unknown>;
};

export type AiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AiGenerateTextResult = {
  provider: AiProviderName;
  model: string;
  content: string;
  rawResponse?: unknown;
  usage?: AiUsage;
  finishReason?: string;
};

export type AiGenerateJsonInput = {
  messages: AiMessage[];
  schemaName?: string;
  schema?: unknown;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
};

export type AiGenerateJsonResult<T = unknown> = {
  provider: AiProviderName;
  model: string;
  data: T;
  rawContent: string;
  rawResponse?: unknown;
  usage?: AiUsage;
  parseWarnings?: string[];
};

export interface AiProvider {
  name: AiProviderName;
  generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult>;
  generateJson<T = unknown>(input: AiGenerateJsonInput): Promise<AiGenerateJsonResult<T>>;
  isConfigured(): boolean;
}

export class AiProviderError extends Error {
  constructor(
    public readonly code:
      | 'AI_PROVIDER_NOT_CONFIGURED'
      | 'AI_PROVIDER_REQUEST_FAILED'
      | 'AI_OUTPUT_PARSE_ERROR'
      | 'AI_CONTEXT_EMPTY'
      | 'AI_UNSUPPORTED_PROVIDER'
      | 'AI_SCHEMA_VALIDATION_FAILED',
    message: string,
    public override readonly cause?: unknown,
    public readonly httpStatus?: number,
  ) {
    super(message);
  }
}

export function isTransientAiProviderHttpStatus(status?: number): boolean {
  return status === 408 || status === 429 || (status !== undefined && status >= 500);
}

export function isTransientAiProviderError(error: AiProviderError): boolean {
  return error.code === 'AI_PROVIDER_REQUEST_FAILED' && isTransientAiProviderHttpStatus(error.httpStatus);
}

export function asAiProviderError(error: unknown): AiProviderError | null {
  if (error instanceof AiProviderError) return error;
  if (!(error instanceof Error) || !('code' in error)) return null;
  const candidate = error as AiProviderError;
  if (typeof candidate.code !== 'string') return null;
  return candidate;
}
