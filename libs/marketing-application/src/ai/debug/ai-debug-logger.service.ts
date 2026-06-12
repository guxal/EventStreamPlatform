import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiDebugTraceRepository } from '@metrics-platform/marketing-infrastructure';
import { AiDebugSanitizerService } from './ai-debug-sanitizer.service';
import type { AiDebugMetadata, AiDebugTraceInput } from './ai-debug.types';

@Injectable()
export class AiDebugLoggerService {
  private readonly logger = new Logger(AiDebugLoggerService.name);

  constructor(
    @Optional() private readonly traceRepository?: AiDebugTraceRepository,
    @Optional()
    private readonly sanitizer: AiDebugSanitizerService = new AiDebugSanitizerService(),
  ) {}

  ensureCorrelationId(correlationId?: string): string {
    return correlationId || randomUUID();
  }
  sanitizeText(input: unknown, maxChars?: number): string {
    return this.sanitizer.sanitizeText(input, maxChars);
  }
  sanitizeValue<T = unknown>(input: T): T {
    return this.sanitizer.sanitizeValue(input);
  }
  containsForbiddenRawData(input: unknown): boolean {
    return this.sanitizer.containsForbiddenRawData(input);
  }
  forbiddenRawDataPaths(input: unknown): string[] {
    return this.sanitizer.findForbidden(input);
  }

  logChatRequestReceived(
    meta: AiDebugMetadata,
    question: string,
    filters: Record<string, unknown> = {},
  ): void {
    this.log('AI_CHAT_REQUEST_RECEIVED', meta, {
      question: this.sanitizeText(question, 1000),
      ...filters,
    });
  }

  logChatResponseSent(
    meta: AiDebugMetadata,
    details: Record<string, unknown> = {},
  ): void {
    this.log('AI_CHAT_RESPONSE_SENT', meta, details);
  }

  logContextBuilt(
    meta: AiDebugMetadata,
    context: unknown,
    extra: Record<string, unknown> = {},
  ): void {
    const contextSummary = this.sanitizer.summarizeContext(context, extra);
    const payload: Record<string, unknown> = { ...contextSummary };
    if (this.flag('AI_DEBUG_LOG_CONTEXT'))
      payload.context = this.sanitizeValue(context);
    this.log('AI_CONTEXT_BUILT', meta, payload);
    void this.persistTrace({
      ...meta,
      contextSummary,
      sanitizedPrompt: payload.context,
    });
  }

  logContextRejected(
    meta: AiDebugMetadata,
    reason: string,
    paths: string[],
  ): void {
    this.log('AI_CONTEXT_REJECTED', meta, { reason, forbiddenPaths: paths });
    void this.persistTrace({
      ...meta,
      errorType: 'raw_context_rejected',
      errorMessage: `${reason}: ${paths.join(', ')}`,
    });
  }

  logPromptBuilt(
    meta: AiDebugMetadata,
    messages: Array<{ role: string; content: string }>,
  ): void {
    const stats = this.sanitizer.promptStats(messages);
    const payload: Record<string, unknown> = { ...stats };
    if (this.flag('AI_DEBUG_LOG_PROMPTS'))
      payload.messages = this.sanitizeValue(messages);
    this.log('AI_PROMPT_BUILT', meta, payload);
    void this.persistTrace({
      ...meta,
      sanitizedPrompt: payload.messages ?? { ...stats },
    });
  }

  logOpenAiRequestStarted(
    meta: AiDebugMetadata,
    details: { timeoutMs?: number; messagesCount?: number } = {},
  ): void {
    this.log('OPENAI_REQUEST_STARTED', meta, details);
  }

  logOpenAiResponseReceived(
    meta: AiDebugMetadata,
    details: {
      durationMs?: number;
      finishReason?: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      responseChars?: number;
      responseContent?: string;
    } = {},
  ): void {
    const payload: Record<string, unknown> = { ...details };
    delete payload.responseContent;
    if (this.flag('AI_DEBUG_LOG_RESPONSES') && details.responseContent)
      payload.responseContent = this.sanitizeText(details.responseContent);
    this.log('OPENAI_RESPONSE_RECEIVED', meta, payload);
    void this.persistTrace({
      ...meta,
      sanitizedResponse: payload.responseContent as string | undefined,
      durationMs: details.durationMs,
      tokenUsage: {
        inputTokens: details.inputTokens,
        outputTokens: details.outputTokens,
        totalTokens: details.totalTokens,
      },
    });
  }

  logOpenAiError(
    meta: AiDebugMetadata,
    details: {
      durationMs?: number;
      errorType?: string;
      errorMessage?: string;
      retryable?: boolean;
    },
  ): void {
    this.log('OPENAI_REQUEST_FAILED', meta, {
      ...details,
      errorMessage: this.sanitizeText(details.errorMessage ?? ''),
    });
    void this.persistTrace({
      ...meta,
      errorType: details.errorType,
      errorMessage: this.sanitizeText(details.errorMessage ?? ''),
      durationMs: details.durationMs,
    });
  }

  logResponseParsingStarted(meta: AiDebugMetadata, outputType?: string): void {
    this.log('AI_RESPONSE_PARSE_STARTED', meta, { outputType });
  }

  logResponseParsingFailed(
    meta: AiDebugMetadata,
    error: unknown,
    response?: unknown,
  ): void {
    this.log('AI_RESPONSE_PARSE_FAILED', meta, {
      errorMessage: this.errorMessage(error),
      responsePreview: this.sanitizeText(response ?? '', 2000),
    });
    void this.persistTrace({
      ...meta,
      errorType: 'parse_failed',
      errorMessage: this.errorMessage(error),
      sanitizedResponse: this.sanitizeText(response ?? '', 2000),
    });
  }

  logResponseParsed(
    meta: AiDebugMetadata,
    details: {
      outputType?: string;
      itemsCount?: number;
      valid?: boolean;
      parsedOutput?: unknown;
    } = {},
  ): void {
    const payload: Record<string, unknown> = {
      outputType: details.outputType,
      itemsCount: details.itemsCount,
      valid: details.valid ?? true,
    };
    if (
      this.flag('AI_DEBUG_LOG_PARSED_OUTPUT') &&
      details.parsedOutput !== undefined
    )
      payload.parsedOutput = this.sanitizeValue(details.parsedOutput);
    this.log('AI_RESPONSE_PARSED', meta, payload);
    void this.persistTrace({
      ...meta,
      parsedOutput: payload.parsedOutput ?? payload,
    });
  }

  logAiOutputPersisted(
    meta: AiDebugMetadata,
    details: Record<string, unknown>,
  ): void {
    this.log('AI_OUTPUT_PERSISTED', meta, details);
    void this.persistTrace({
      ...meta,
      parsedOutput: this.sanitizeValue(details),
    });
  }

  logAiSkipped(meta: AiDebugMetadata, details: Record<string, unknown>): void {
    this.log('AI_SKIPPED', meta, details);
    void this.persistTrace({
      ...meta,
      errorType: String(details.reason ?? 'skipped'),
      errorMessage: this.sanitizeText(
        details.errorMessage ?? details.reason ?? '',
      ),
    });
  }

  log(
    event: string,
    meta: AiDebugMetadata = {},
    details: Record<string, unknown> = {},
  ): void {
    if (!this.enabled()) return;
    this.logger.log(
      this.sanitizeValue({ event, ...this.common(meta), ...details }),
    );
  }

  private common(meta: AiDebugMetadata): Record<string, unknown> {
    return {
      ...meta,
      correlationId: this.ensureCorrelationId(meta.correlationId),
      timestamp: new Date().toISOString(),
    };
  }

  private async persistTrace(input: AiDebugTraceInput): Promise<void> {
    if (!this.flag('AI_DEBUG_PERSIST_TRACES') || !this.traceRepository) return;
    try {
      await this.traceRepository.save({
        correlationId: this.ensureCorrelationId(input.correlationId),
        projectId: input.projectId,
        importId: input.importId,
        rawFileId: input.rawFileId,
        source: input.source,
        reportType: input.reportType,
        aiFlow: input.aiFlow,
        promptType: input.promptType,
        model: input.model,
        contextSummary: input.contextSummary
          ? (this.sanitizeValue(input.contextSummary) as Record<
              string,
              unknown
            >)
          : undefined,
        sanitizedPrompt:
          input.sanitizedPrompt === undefined
            ? undefined
            : this.sanitizeValue(input.sanitizedPrompt),
        sanitizedResponse: input.sanitizedResponse
          ? this.sanitizeText(input.sanitizedResponse)
          : undefined,
        parsedOutput:
          input.parsedOutput === undefined
            ? undefined
            : this.sanitizeValue(input.parsedOutput),
        errorType: input.errorType,
        errorMessage: input.errorMessage
          ? this.sanitizeText(input.errorMessage)
          : undefined,
        durationMs: input.durationMs,
        tokenUsage: input.tokenUsage
          ? (this.sanitizeValue(input.tokenUsage) as Record<string, unknown>)
          : undefined,
      });
    } catch (error) {
      this.logger.warn({
        event: 'AI_DEBUG_TRACE_PERSIST_FAILED',
        correlationId: input.correlationId,
        error: this.errorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  private enabled(): boolean {
    return (
      this.flag('AI_DEBUG_ENABLED') ||
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'local'
    );
  }
  private flag(name: string): boolean {
    return String(process.env[name] ?? '').toLowerCase() === 'true';
  }
  private errorMessage(error: unknown): string {
    return this.sanitizeText(
      error instanceof Error ? error.message : String(error),
    );
  }
}
