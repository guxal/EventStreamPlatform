import { MockAiProvider } from './mock-ai.provider';

describe('MockAiProvider', () => {
  it('returns deterministic text', async () => {
    const result = await new MockAiProvider().generateText({ messages: [{ role: 'user', content: 'hello' }], metadata: { facts: [{ factType: 'NO_RELIABLE_COST_SOURCE' }] } });
    expect(result.content).toContain('Mock AI response');
    expect(result.content).toContain('ROAS');
  });

  it('returns deterministic JSON', async () => {
    const result = await new MockAiProvider().generateJson<{ recommendations: unknown[] }>({ schemaName: 'marketing_recommendations', messages: [], metadata: { facts: [{ factType: 'NO_RELIABLE_COST_SOURCE', severity: 'INFO', confidence: 0.9 }] } });
    expect(result.data.recommendations).toHaveLength(1);
  });
});
