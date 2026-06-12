import { Injectable } from '@nestjs/common';
import { AiDebugLoggerService } from '../debug';
import {
  AiProviderError,
  AiProviderName,
  type AiProvider,
} from './ai-provider.types';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiProvider } from './openai.provider';

@Injectable()
export class AiProviderFactory {
  constructor(
    private readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService(),
  ) {}
  getProvider(requestedProvider?: string): AiProvider {
    const provider = this.providerName(requestedProvider);
    const selected = this.create(provider);
    if (selected.isConfigured()) return selected;
    if (this.aiRequired())
      throw new AiProviderError(
        'AI_PROVIDER_NOT_CONFIGURED',
        `${provider} provider is required but not configured`,
      );
    if (this.mockEnabled()) return new MockAiProvider(this.debugLogger);
    throw new AiProviderError(
      'AI_PROVIDER_NOT_CONFIGURED',
      `${provider} provider is not configured and mock provider is disabled`,
    );
  }

  private providerName(requestedProvider?: string): AiProviderName {
    const raw = String(requestedProvider || process.env.AI_PROVIDER || '')
      .trim()
      .toLowerCase();
    if (!raw)
      return this.mockEnabled() ? AiProviderName.MOCK : AiProviderName.OPENAI;
    if (raw === 'openai') return AiProviderName.OPENAI;
    if (raw === 'gemini') return AiProviderName.GEMINI;
    if (raw === 'claude' || raw === 'anthropic') return AiProviderName.CLAUDE;
    if (raw === 'mock') return AiProviderName.MOCK;
    throw new AiProviderError(
      'AI_UNSUPPORTED_PROVIDER',
      `Unsupported AI_PROVIDER: ${raw}`,
    );
  }

  private create(provider: AiProviderName): AiProvider {
    if (provider === AiProviderName.OPENAI)
      return new OpenAiProvider(this.debugLogger);
    if (provider === AiProviderName.GEMINI)
      return new GeminiProvider(this.debugLogger);
    if (provider === AiProviderName.CLAUDE)
      return new ClaudeProvider(this.debugLogger);
    return new MockAiProvider(this.debugLogger);
  }

  private mockEnabled(): boolean {
    return (
      process.env.AI_ENABLE_MOCK !== 'false' ||
      process.env.NODE_ENV === 'test' ||
      process.env.AI_PROVIDER === 'mock'
    );
  }

  private aiRequired(): boolean {
    return process.env.AI_REQUIRED === 'true';
  }
}
