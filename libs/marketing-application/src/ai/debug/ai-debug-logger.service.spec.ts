import { Logger } from '@nestjs/common';
import { AiDebugLoggerService } from './ai-debug-logger.service';
import { AiDebugSanitizerService } from './ai-debug-sanitizer.service';

describe('AiDebugLoggerService', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.AI_DEBUG_ENABLED = 'true';
    delete process.env.AI_DEBUG_LOG_CONTEXT;
    delete process.env.AI_DEBUG_LOG_PROMPTS;
    delete process.env.AI_DEBUG_LOG_RESPONSES;
    delete process.env.AI_DEBUG_LOG_PARSED_OUTPUT;
    delete process.env.AI_DEBUG_PERSIST_TRACES;
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logs context summary without raw context by default', () => {
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    logger.logContextBuilt(
      { correlationId: 'corr-1', projectId: 'project-1', aiFlow: 'chat' },
      {
        facts: [{ factType: 'EVENT_REVENUE_EMPTY' }],
        kpis: { installs: 1 },
        unavailableMetrics: [{ metric: 'roas', reason: 'No cost' }],
        sources: ['appsflyer'],
      },
    );
    const payload = logSpy.mock.calls[0][0];
    expect(payload.event).toBe('AI_CONTEXT_BUILT');
    expect(payload.correlationId).toBe('corr-1');
    expect(payload.factsCount).toBe(1);
    expect(payload.kpisCount).toBe(1);
    expect(payload.hasAppsflyer).toBe(true);
    expect(payload.context).toBeUndefined();
  });

  it('does not log prompts when AI_DEBUG_LOG_PROMPTS=false', () => {
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    logger.logPromptBuilt(
      { correlationId: 'corr-2', aiFlow: 'report', promptType: 'REPORT' },
      [
        {
          role: 'user',
          content: 'hello sk-test123456789012345678901234567890',
        },
      ],
    );
    const payload = logSpy.mock.calls[0][0];
    expect(payload.event).toBe('AI_PROMPT_BUILT');
    expect(payload.messages).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('sk-test');
  });

  it('logs sanitized prompts when AI_DEBUG_LOG_PROMPTS=true', () => {
    process.env.AI_DEBUG_LOG_PROMPTS = 'true';
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    logger.logPromptBuilt(
      { correlationId: 'corr-3', aiFlow: 'chat', promptType: 'AI_CHAT' },
      [
        {
          role: 'user',
          content:
            'email a@test.com token Bearer abc.def.ghi customer_user_id=abc123 device_id=00000000-0000-0000-0000-000000000000',
        },
      ],
    );
    const serialized = JSON.stringify(logSpy.mock.calls[0][0]);
    expect(serialized).toContain('[REDACTED_EMAIL]');
    expect(serialized).toContain('Bearer [REDACTED_BEARER_TOKEN]');
    expect(serialized).toContain('[REDACTED_CUSTOMER_USER_ID]');
    expect(serialized).toContain('[REDACTED_DEVICE_ID]');
    expect(serialized).not.toContain('a@test.com');
    expect(serialized).not.toContain('abc.def.ghi');
  });

  it('logs OpenAI request and response with correlationId', () => {
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    logger.logOpenAiRequestStarted(
      { correlationId: 'corr-4', aiFlow: 'report', model: 'gpt-test' },
      { messagesCount: 2, timeoutMs: 60000 },
    );
    logger.logOpenAiResponseReceived(
      { correlationId: 'corr-4', aiFlow: 'report', model: 'gpt-test' },
      {
        durationMs: 10,
        inputTokens: 1,
        outputTokens: 2,
        totalTokens: 3,
        responseChars: 12,
        responseContent: 'secret response',
      },
    );
    expect(logSpy.mock.calls[0][0]).toMatchObject({
      event: 'OPENAI_REQUEST_STARTED',
      correlationId: 'corr-4',
    });
    expect(logSpy.mock.calls[1][0]).toMatchObject({
      event: 'OPENAI_RESPONSE_RECEIVED',
      correlationId: 'corr-4',
      totalTokens: 3,
    });
    expect(logSpy.mock.calls[1][0].responseContent).toBeUndefined();
  });

  it('logs OpenAI errors without secrets', () => {
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    logger.logOpenAiError(
      { correlationId: 'corr-5', aiFlow: 'chat', model: 'gpt-test' },
      {
        errorType: 'invalid_api_key',
        errorMessage:
          'bad key sk-abcdefghijklmnopqrstuvwxyz123456 Bearer abc.def.ghi',
        retryable: false,
      },
    );
    const serialized = JSON.stringify(logSpy.mock.calls[0][0]);
    expect(serialized).toContain('[REDACTED_API_KEY]');
    expect(serialized).toContain('Bearer [REDACTED_BEARER_TOKEN]');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  it('logs invalid JSON parse failures with a sanitized preview', () => {
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    logger.logResponseParsingFailed(
      { correlationId: 'corr-6', aiFlow: 'recommendation' },
      new Error('Unexpected token'),
      '{ bad: "user@example.com" }',
    );
    expect(logSpy.mock.calls[0][0]).toMatchObject({
      event: 'AI_RESPONSE_PARSE_FAILED',
      correlationId: 'corr-6',
    });
    expect(logSpy.mock.calls[0][0].responsePreview).toContain(
      '[REDACTED_EMAIL]',
    );
  });

  it('detects forbidden raw data keys', () => {
    const logger = new AiDebugLoggerService(
      undefined,
      new AiDebugSanitizerService(),
    );
    expect(
      logger.containsForbiddenRawData({
        rawCsv: 'a,b',
        nested: { raw_payload: {} },
      }),
    ).toBe(true);
    expect(
      logger.forbiddenRawDataPaths({
        rawCsv: 'a,b',
        nested: { raw_payload: {} },
      }),
    ).toEqual(['rawCsv', 'nested.raw_payload']);
  });

  it('persists traces only when AI_DEBUG_PERSIST_TRACES=true', async () => {
    const repo = { save: jest.fn().mockResolvedValue(undefined) };
    const logger = new AiDebugLoggerService(
      repo as any,
      new AiDebugSanitizerService(),
    );
    logger.logResponseParsed(
      { correlationId: 'corr-7', aiFlow: 'report' },
      { outputType: 'report', valid: true },
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(repo.save).not.toHaveBeenCalled();
    process.env.AI_DEBUG_PERSIST_TRACES = 'true';
    logger.logResponseParsed(
      { correlationId: 'corr-7', aiFlow: 'report' },
      { outputType: 'report', valid: true },
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
