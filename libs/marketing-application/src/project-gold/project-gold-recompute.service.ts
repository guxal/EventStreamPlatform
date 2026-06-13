import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClickHouseProjectAnalyticsRepository, DetectedFactRepository, ProjectAnalysisRunRepository } from '@metrics-platform/marketing-infrastructure';
import type { ProjectGoldRecomputeJobPayload } from '@metrics-platform/marketing-shared';
import { AppsFlyerProjectGoldCalculator } from './appsflyer-project-gold.calculator';
import { ProjectAiSummaryOrchestratorService } from './project-ai-summary-orchestrator.service';
import { ProjectFactsGeneratorService } from './project-facts-generator.service';

export enum ProjectAnalysisErrorStage {
  PROJECT_ANALYSIS_REQUEST_VALIDATION = 'PROJECT_ANALYSIS_REQUEST_VALIDATION',
  PROJECT_DATA_AVAILABILITY = 'PROJECT_DATA_AVAILABILITY',
  PROJECT_METRIC_PERSISTENCE = 'PROJECT_METRIC_PERSISTENCE',
  PROJECT_FACT_GENERATION = 'PROJECT_FACT_GENERATION',
  PROJECT_AI_SUMMARY_GENERATION = 'PROJECT_AI_SUMMARY_GENERATION',
}

@Injectable()
export class ProjectGoldRecomputeService {
  private readonly logger = new Logger(ProjectGoldRecomputeService.name);
  constructor(
    private readonly runRepository: ProjectAnalysisRunRepository,
    private readonly calculator: AppsFlyerProjectGoldCalculator,
    private readonly analyticsRepository: ClickHouseProjectAnalyticsRepository,
    private readonly factsGenerator: ProjectFactsGeneratorService,
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly aiSummaryOrchestrator: ProjectAiSummaryOrchestratorService,
  ) {}

  async process(payload: ProjectGoldRecomputeJobPayload) {
    const analysisRunId = payload.analysisRunId ?? randomUUID();
    const correlationId = payload.correlationId ?? randomUUID();
    try {
      if (!payload.projectId) throw new Error('Invalid recompute-project-gold payload: missing projectId');
      if ((payload.source ?? '').toLowerCase() !== 'appsflyer') throw new Error(`Unsupported project analysis source ${payload.source}`);
      let run = await this.runRepository.findById(analysisRunId);
      if (!run) run = await this.runRepository.create({ id: analysisRunId, projectId: payload.projectId, source: 'appsflyer', dateRangeStart: payload.dateRangeStart, dateRangeEnd: payload.dateRangeEnd, triggeredBy: payload.triggeredBy, correlationId, metadata: { force: payload.force } });
      this.logger.log({ event: 'PROJECT_GOLD_RECOMPUTE_STARTED', projectId: payload.projectId, analysisRunId, correlationId, triggeredBy: payload.triggeredBy });
      await this.runRepository.updateStatus(analysisRunId, 'PROCESSING');
      await this.runRepository.updateStatus(analysisRunId, 'COMPUTING_KPIS');
      const summary = await this.calculator.calculate({ projectId: payload.projectId, analysisRunId, source: 'appsflyer', dateRangeStart: payload.dateRangeStart, dateRangeEnd: payload.dateRangeEnd, correlationId });
      await this.analyticsRepository.replaceProjectMetricSnapshots(summary);
      this.logger.log({ event: 'PROJECT_METRICS_PERSISTED', projectId: payload.projectId, analysisRunId, correlationId });
      await this.runRepository.updateStatus(analysisRunId, 'GENERATING_FACTS', { summary });
      const facts = this.factsGenerator.generate(summary);
      await this.detectedFactRepository.deleteByScope(payload.projectId, { source: 'appsflyer', scopeType: 'PROJECT', scopeId: payload.projectId, dateRangeStart: payload.dateRangeStart ?? null, dateRangeEnd: payload.dateRangeEnd ?? null });
      const savedFacts = await this.detectedFactRepository.saveMany(payload.projectId, facts);
      this.logger.log({ event: 'PROJECT_FACTS_GENERATED', projectId: payload.projectId, analysisRunId, correlationId, factsCount: savedFacts.length });
      await this.runRepository.updateStatus(analysisRunId, 'GENERATING_AI_SUMMARY');
      const aiOutputs = await this.aiSummaryOrchestrator.generate(payload.projectId, savedFacts, summary, correlationId);
      await this.runRepository.updateStatus(analysisRunId, 'COMPLETED', { summary, recommendations: aiOutputs.recommendations.length, reportId: aiOutputs.report.id });
      this.logger.log({ event: 'PROJECT_GOLD_RECOMPUTE_COMPLETED', projectId: payload.projectId, analysisRunId, correlationId, factsCount: savedFacts.length });
      return { analysisRunId, summary, facts: savedFacts, aiOutputs };
    } catch (error) {
      const errorStage = this.inferErrorStage(error);
      await this.runRepository.fail(analysisRunId, { errorStage, errorMessage: error instanceof Error ? error.message : String(error), errorSummary: { correlationId, projectId: payload.projectId } }).catch(() => undefined);
      this.logger.error({ event: 'PROJECT_GOLD_RECOMPUTE_FAILED', projectId: payload.projectId, analysisRunId, correlationId, errorStage, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private inferErrorStage(error: unknown): ProjectAnalysisErrorStage {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('payload') || message.includes('Unsupported')) return ProjectAnalysisErrorStage.PROJECT_ANALYSIS_REQUEST_VALIDATION;
    if (message.includes('metric_snapshots')) return ProjectAnalysisErrorStage.PROJECT_METRIC_PERSISTENCE;
    if (message.includes('detected_facts')) return ProjectAnalysisErrorStage.PROJECT_FACT_GENERATION;
    if (
      message.includes('recommendations') ||
      message.includes('ai_reports') ||
      message.includes('invalid JSON') ||
      message.includes('AI')
    )
      return ProjectAnalysisErrorStage.PROJECT_AI_SUMMARY_GENERATION;
    return ProjectAnalysisErrorStage.PROJECT_DATA_AVAILABILITY;
  }
}
