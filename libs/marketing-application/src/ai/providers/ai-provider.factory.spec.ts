import { AiProviderFactory } from './ai-provider.factory';
import { AiProviderName, AiProviderError } from './ai-provider.types';

describe('AiProviderFactory', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; });
  afterAll(() => { process.env = originalEnv; });

  it('selects mock provider', () => {
    process.env.AI_PROVIDER = 'mock';
    expect(new AiProviderFactory().getProvider().name).toBe(AiProviderName.MOCK);
  });

  it('selects OpenAI provider when configured', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test';
    expect(new AiProviderFactory().getProvider().name).toBe(AiProviderName.OPENAI);
  });

  it('selects Gemini provider when configured', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test';
    expect(new AiProviderFactory().getProvider().name).toBe(AiProviderName.GEMINI);
  });

  it('selects Claude provider when configured', () => {
    process.env.AI_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test';
    expect(new AiProviderFactory().getProvider().name).toBe(AiProviderName.CLAUDE);
  });

  it('rejects missing provider when AI_REQUIRED=true', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = '';
    process.env.AI_REQUIRED = 'true';
    expect(() => new AiProviderFactory().getProvider()).toThrow(AiProviderError);
  });
});
