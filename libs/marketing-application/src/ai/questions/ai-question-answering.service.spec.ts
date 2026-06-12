import { AiProviderError } from '../providers';
import { AiQuestionAnsweringService } from './ai-question-answering.service';
import { AiQuestionIntentRouter } from './ai-question-intent-router.service';

const dataService = (overrides: Record<string, unknown> = {}) => ({
  getUnavailableMetrics: jest.fn().mockResolvedValue([{ metric: 'roas', reason: 'No reliable cost source is available in the bounded processed data.' }]),
  getProjectOverview: jest.fn().mockResolvedValue({ unavailableMetrics: [{ metric: 'roas', reason: 'No reliable cost source is available.' }] }),
  getTopFacts: jest.fn().mockResolvedValue([]),
  getContextObjects: jest.fn().mockResolvedValue([]),
  getEntityPerformance: jest.fn().mockResolvedValue([]),
  getCampaignPerformance: jest.fn().mockResolvedValue([]),
  getBlockedTraffic: jest.fn().mockResolvedValue({}),
  getRecommendations: jest.fn().mockResolvedValue([]),
  getLatestReports: jest.fn().mockResolvedValue([]),
  getImportSummary: jest.fn().mockResolvedValue(null),
  getEventsByName: jest.fn().mockResolvedValue([]),
  getSemanticEntities: jest.fn().mockResolvedValue([]),
  getSemanticRelationships: jest.fn().mockResolvedValue([]),
  ...overrides,
});

describe('AiQuestionAnsweringService', () => {
  it('refuses to calculate ROAS when cost source is missing and provider is unavailable', async () => {
    const service = new AiQuestionAnsweringService(new AiQuestionIntentRouter(), dataService() as any, { getProvider: () => { throw new AiProviderError('AI_PROVIDER_NOT_CONFIGURED', 'missing'); } } as any);
    const answer = await service.answer({ projectId: 'project-1', source: 'appsflyer', question: 'Can we calculate ROAS?' });
    expect(answer.answer).toContain('cannot be calculated');
    expect(answer.answer).toContain('Google Ads');
    expect(answer.generationStatus).toBe('SKIPPED');
  });

  it('explains Event Revenue empty with Event Value.amount when facts exist', async () => {
    const service = new AiQuestionAnsweringService(new AiQuestionIntentRouter(), dataService({
      getTopFacts: jest.fn().mockResolvedValue([{ factType: 'EVENT_REVENUE_EMPTY' }, { factType: 'EVENT_AMOUNT_IN_JSON' }]),
    }) as any, { getProvider: () => { throw new AiProviderError('AI_PROVIDER_NOT_CONFIGURED', 'missing'); } } as any);
    const answer = await service.answer({ projectId: 'project-1', source: 'appsflyer', question: 'Why is AppsFlyer Event Revenue empty?' });
    expect(answer.answer).toContain('Event Value.amount');
    expect(answer.answer).not.toContain('ROAS is');
  });

  it('says denominator data is required before funnel-rate calculations', async () => {
    const service = new AiQuestionAnsweringService(new AiQuestionIntentRouter(), dataService({
      getTopFacts: jest.fn().mockResolvedValue([{ factType: 'LOW_INSTALL_TO_DEPOSIT' }]),
    }) as any, { getProvider: () => { throw new AiProviderError('AI_PROVIDER_NOT_CONFIGURED', 'missing'); } } as any);
    const answer = await service.answer({ projectId: 'project-1', source: 'appsflyer', question: 'Why are deposits low?' });
    expect(answer.answer).toContain('LOW_INSTALL_TO_DEPOSIT');
    expect(answer.answer).toContain('numerator and denominator');
  });
});
