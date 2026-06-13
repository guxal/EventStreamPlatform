import { Injectable, Logger } from '@nestjs/common';
import type { DetectedFact, ProjectGoldSummary } from '@metrics-platform/marketing-shared';
import { AiOutputOrchestratorService } from '../ai/orchestration/ai-output-orchestrator.service';

@Injectable()
export class ProjectAiSummaryOrchestratorService {
  private readonly logger = new Logger(ProjectAiSummaryOrchestratorService.name);
  constructor(private readonly aiOutputOrchestrator: AiOutputOrchestratorService) {}

  async generate(projectId: string, facts: DetectedFact[], summary: ProjectGoldSummary, correlationId?: string) {
    this.logger.log({ event: 'PROJECT_AI_SUMMARY_STARTED', projectId, correlationId, factsCount: facts.length });
    const extras = {
      kpis: { ...summary.kpis, projectGoldSummary: summary },
      unavailableMetrics: [
        { metric: 'ROAS', reason: 'No reliable cost source is available from AppsFlyer-only project analysis.' },
        { metric: 'CPA', reason: 'No reliable cost source is available from AppsFlyer-only project analysis.' },
        { metric: 'CAC', reason: 'No reliable cost source is available from AppsFlyer-only project analysis.' },
      ],
      warnings: summary.limitations,
      dataQualityNotes: [
        'Project Gold metrics are computed deterministically from ClickHouse Silver marketing_events.',
        'Blocked traffic is excluded from the main funnel and analyzed separately.',
        'Period funnel and cohort funnel are distinct; cohort is preferred only when available.',
      ],
      correlationId,
      source: summary.source,
      projectAnalysisRunId: summary.analysisRunId,
      projectGoldSummary: summary,
    };
    const recommendations = await this.aiOutputOrchestrator.generateAndStoreRecommendations(projectId, facts, extras);
    const report = await this.aiOutputOrchestrator.generateAndStoreReport(projectId, facts, extras);
    this.logger.log({ event: 'PROJECT_AI_SUMMARY_COMPLETED', projectId, correlationId, recommendations: recommendations.length, reportId: report.id });
    return { recommendations, report };
  }
}
