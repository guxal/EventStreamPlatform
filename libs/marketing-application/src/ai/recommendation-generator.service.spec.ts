import { EntityType, FactType, Severity } from '@metrics-platform/marketing-shared';
import { AiContextBuilderService } from './context';
import { MockAiProvider } from './providers';
import { RecommendationGeneratorService } from './recommendation-generator.service';

const fact = {
  entityId: 'project-1',
  entityType: EntityType.ACCOUNT,
  factType: FactType.NO_RELIABLE_COST_SOURCE,
  severity: Severity.INFO,
  confidence: 0.99,
  temporalContext: { lookbackDays: 0, startDate: '2026-06-01', endDate: '2026-06-01' },
  metricsSummary: { source: 'APPSFLYER', reportType: 'installs' },
};

describe('RecommendationGeneratorService', () => {
  it('uses AiProvider interface and does not claim ROAS as available', async () => {
    const context = new AiContextBuilderService().buildContext({ projectId: 'project-1', facts: [fact] });
    const recommendations = await new RecommendationGeneratorService().generateFromContext(context, new MockAiProvider());
    expect(recommendations[0].limitations?.join(' ')).toContain('Mock provider');
    expect(JSON.stringify(context.unavailableMetrics)).toContain('roas');
  });
});
