import { EntityType, FactType, Severity } from '@metrics-platform/marketing-shared';
import { AiContextBuilderService } from '../context';
import { MockAiProvider } from '../providers';
import { RecommendationGeneratorService } from '../recommendation-generator.service';
import { ReportGeneratorService } from '../report-generator.service';
import { AiOutputOrchestratorService } from './ai-output-orchestrator.service';

const fact = {
  entityId: 'project-1',
  entityType: EntityType.ACCOUNT,
  factType: FactType.NO_RELIABLE_COST_SOURCE,
  severity: Severity.INFO,
  confidence: 0.99,
  temporalContext: { lookbackDays: 0, startDate: '2026-06-01', endDate: '2026-06-01' },
  metricsSummary: { source: 'APPSFLYER', reportType: 'installs', dataImportId: '11111111-1111-1111-1111-111111111111' },
};

describe('AiOutputOrchestratorService', () => {
  it('replaces scoped AI outputs before persisting recommendations and reports', async () => {
    const recommendationRepository = { deleteByScope: jest.fn().mockResolvedValue(1), saveMany: jest.fn(async (items) => items) };
    const aiReportRepository = { deleteByScope: jest.fn().mockResolvedValue(1), save: jest.fn(async (item) => item) };
    const service = new AiOutputOrchestratorService(
      new RecommendationGeneratorService(),
      new ReportGeneratorService(),
      recommendationRepository as any,
      aiReportRepository as any,
      new AiContextBuilderService(),
      { getProvider: () => new MockAiProvider() } as any,
    );

    await service.generateAndStoreRecommendations('project-1', [fact]);
    await service.generateAndStoreReport('project-1', [fact]);

    expect(recommendationRepository.deleteByScope).toHaveBeenCalledWith('project-1', { source: 'appsflyer', reportType: 'installs', importId: '11111111-1111-1111-1111-111111111111' });
    expect(aiReportRepository.deleteByScope).toHaveBeenCalledWith('project-1', { source: 'appsflyer', reportType: 'installs', importId: '11111111-1111-1111-1111-111111111111' });
    expect(recommendationRepository.saveMany).toHaveBeenCalledTimes(1);
    expect(aiReportRepository.save).toHaveBeenCalledTimes(1);
  });
});
