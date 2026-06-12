import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  AnalysisType,
  AiReportRecord,
  MarketingAiAnalysisJobPayload,
  RecommendationRecord,
} from '@metrics-platform/marketing-shared';
import {
  AnalysisRunRepository,
  AiReportRepository,
  AppsFlyerEventsRepository,
  AppsFlyerSnapshotsRepository,
  ContextObjectRepository,
  DetectedFactRepository,
  RecommendationRepository,
  SemanticEntityRepository,
  SemanticRelationshipRepository,
} from '@metrics-platform/marketing-infrastructure';
import { AiContextBuilderService } from '../context';
import {
  AiProviderError,
  AiProviderFactory,
  AiProviderName,
} from '../providers';
import { RecommendationGeneratorService } from '../recommendation-generator.service';
import { ReportGeneratorService } from '../report-generator.service';
import { AiDebugLoggerService } from '../debug';

export enum AiAnalysisErrorStage {
  ANALYSIS_RUN_VALIDATION = 'ANALYSIS_RUN_VALIDATION',
  AI_CONTEXT_BUILDING = 'AI_CONTEXT_BUILDING',
  AI_PROVIDER_SELECTION = 'AI_PROVIDER_SELECTION',
  AI_RECOMMENDATION_GENERATION = 'AI_RECOMMENDATION_GENERATION',
  AI_REPORT_GENERATION = 'AI_REPORT_GENERATION',
  AI_OUTPUT_PERSISTENCE = 'AI_OUTPUT_PERSISTENCE',
}

@Injectable()
export class AiAnalysisRunnerService {
  constructor(
    private readonly analysisRunRepository: AnalysisRunRepository,
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly appsFlyerEventsRepository: AppsFlyerEventsRepository,
    private readonly appsFlyerSnapshotsRepository: AppsFlyerSnapshotsRepository,
    private readonly semanticEntityRepository: SemanticEntityRepository,
    private readonly semanticRelationshipRepository: SemanticRelationshipRepository,
    private readonly contextObjectRepository: ContextObjectRepository,
    private readonly recommendationRepository: RecommendationRepository,
    private readonly aiReportRepository: AiReportRepository,
    private readonly contextBuilder: AiContextBuilderService,
    private readonly providerFactory: AiProviderFactory,
    private readonly recommendationGenerator: RecommendationGeneratorService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService(),
  ) {}

  async process(payload: MarketingAiAnalysisJobPayload): Promise<void> {
    let stage = AiAnalysisErrorStage.ANALYSIS_RUN_VALIDATION;
    try {
      const run = await this.analysisRunRepository.findById(
        payload.projectId,
        payload.analysisRunId,
      );
      if (!run)
        throw new Error(
          `Analysis run ${payload.analysisRunId} not found for project ${payload.projectId}`,
        );
      await this.analysisRunRepository.markRunning(
        payload.projectId,
        payload.analysisRunId,
        {
          source: payload.source,
          reportType: payload.reportType,
          importId: payload.importId,
          rawFileId: payload.rawFileId,
          analysisType: payload.analysisType,
        },
      );
      stage = AiAnalysisErrorStage.AI_CONTEXT_BUILDING;
      const context = await this.buildStoredContext(payload);
      if (
        context.facts.length === 0 &&
        Object.keys(context.kpis).length === 0 &&
        context.contextObjects.length === 0
      ) {
        this.debugLogger.logAiSkipped(
          {
            correlationId: payload.correlationId,
            projectId: payload.projectId,
            importId: payload.importId,
            rawFileId: payload.rawFileId,
            source: payload.source,
            reportType: payload.reportType,
            aiFlow: 'orchestrator',
          },
          {
            reason: 'NO_BOUNDED_PROCESSED_CONTEXT',
            factsCount: 0,
            kpisCount: 0,
            contextObjectCount: 0,
          },
        );
        await this.analysisRunRepository.markSkipped(
          payload.projectId,
          payload.analysisRunId,
          {
            reason:
              'No bounded processed facts, KPIs, or context objects available.',
            factsCount: 0,
            kpisCount: 0,
            contextObjectCount: 0,
          },
        );
        return;
      }
      stage = AiAnalysisErrorStage.AI_PROVIDER_SELECTION;
      const provider = this.providerFactory.getProvider(payload.provider);
      const providerName =
        provider.name === AiProviderName.MOCK
          ? 'mock'
          : provider.name.toLowerCase();
      const model =
        provider.name === AiProviderName.MOCK
          ? 'mock-local'
          : payload.model ||
            process.env.AI_MODEL ||
            provider.name.toLowerCase();
      const generationStatus =
        provider.name === AiProviderName.MOCK ? 'MOCKED' : 'COMPLETED';
      let recommendations: RecommendationRecord[] = [];
      let report: AiReportRecord | null = null;
      if (this.shouldGenerateRecommendations(payload.analysisType)) {
        stage = AiAnalysisErrorStage.AI_RECOMMENDATION_GENERATION;
        const generated =
          await this.recommendationGenerator.generateFromContext(
            context,
            provider,
            {
              correlationId: payload.correlationId,
              importId: payload.importId,
              rawFileId: payload.rawFileId,
              source: payload.source,
              reportType: payload.reportType,
              model,
            },
          );
        recommendations = generated.map((item, index) => ({
          id: randomUUID(),
          projectId: payload.projectId,
          factType: item.factType,
          title: item.title,
          body: item.body,
          priority: item.priority,
          modelName: providerName,
          modelVersion: model,
          createdAt: new Date().toISOString(),
          analysisRunId: payload.analysisRunId,
          source: payload.source,
          reportType: payload.reportType,
          importId: payload.importId,
          rawFileId: payload.rawFileId,
          provider: providerName,
          model,
          generationStatus,
          summary: item.summary ?? item.body,
          recommendedActions: item.recommendedActions ?? [],
          limitations: item.limitations ?? [],
          relatedFactIds:
            item.relatedFactIds ??
            context.facts
              .map((fact) => String(fact.id ?? fact.factType))
              .slice(index, index + 1),
          relatedEntityIds:
            item.relatedEntityIds ??
            context.semanticEntities
              .map((entity: any) => String(entity.id))
              .filter(Boolean)
              .slice(0, 5),
          confidence: item.confidence ?? 0,
          metadata: {
            ...item,
            provider: providerName,
            model,
            generationStatus,
            analysisRunId: payload.analysisRunId,
            source: payload.source,
            reportType: payload.reportType,
            importId: payload.importId,
            rawFileId: payload.rawFileId,
            rawAiOutput: item.rawAiOutput,
          },
        }));
      }
      if (this.shouldGenerateReport(payload.analysisType)) {
        stage = AiAnalysisErrorStage.AI_REPORT_GENERATION;
        const generated =
          await this.reportGenerator.generateMarkdownReportFromContext(
            context,
            provider,
            {
              correlationId: payload.correlationId,
              importId: payload.importId,
              rawFileId: payload.rawFileId,
              source: payload.source,
              reportType: payload.reportType,
              model,
            },
          );
        report = {
          id: randomUUID(),
          projectId: payload.projectId,
          reportType:
            payload.analysisType === 'PROJECT_SUMMARY'
              ? 'PROJECT_SUMMARY'
              : 'CUSTOM',
          title: this.reportTitle(payload.analysisType),
          contentMarkdown: generated.content,
          modelName: providerName,
          modelVersion: model,
          createdAt: new Date().toISOString(),
          analysisRunId: payload.analysisRunId,
          source: payload.source,
          sourceReportType: payload.reportType,
          importId: payload.importId,
          rawFileId: payload.rawFileId,
          provider: providerName,
          model,
          generationStatus,
          relatedFactIds: context.facts
            .map((fact) => String(fact.id ?? fact.factType))
            .slice(0, 100),
          relatedEntityIds: context.semanticEntities
            .map((entity: any) => String(entity.id))
            .filter(Boolean)
            .slice(0, 100),
          metadata: {
            provider: providerName,
            model,
            generationStatus,
            analysisRunId: payload.analysisRunId,
            source: payload.source,
            reportType: payload.reportType,
            importId: payload.importId,
            rawFileId: payload.rawFileId,
            rawAiOutput: generated.rawAiOutput,
          },
        };
      }
      stage = AiAnalysisErrorStage.AI_OUTPUT_PERSISTENCE;
      if (recommendations.length > 0) {
        await this.recommendationRepository.deleteByScope(payload.projectId, {
          source: payload.source,
          reportType: payload.reportType,
          importId: payload.importId,
          analysisRunId: payload.analysisRunId,
        });
        await this.recommendationRepository.saveMany(recommendations);
        this.debugLogger.logAiOutputPersisted(
          {
            correlationId: payload.correlationId,
            projectId: payload.projectId,
            importId: payload.importId,
            rawFileId: payload.rawFileId,
            source: payload.source,
            reportType: payload.reportType,
            aiFlow: 'recommendation',
            promptType: 'RECOMMENDATION',
            model,
          },
          {
            outputType: 'recommendations',
            itemsCount: recommendations.length,
            replacedExisting: true,
            recordIds: recommendations.map((item) => item.id),
          },
        );
      }
      if (report) {
        await this.aiReportRepository.deleteByScope(payload.projectId, {
          source: payload.source,
          reportType: payload.reportType,
          importId: payload.importId,
          analysisRunId: payload.analysisRunId,
        });
        await this.aiReportRepository.save(report);
        this.debugLogger.logAiOutputPersisted(
          {
            correlationId: payload.correlationId,
            projectId: payload.projectId,
            importId: payload.importId,
            rawFileId: payload.rawFileId,
            source: payload.source,
            reportType: payload.reportType,
            aiFlow: 'report',
            promptType: 'REPORT',
            model,
          },
          {
            outputType: 'ai_report',
            recordId: report.id,
            replacedExisting: true,
          },
        );
      }
      const outputSummary = {
        provider: providerName,
        model,
        generationStatus,
        factsCount: context.facts.length,
        kpisCount: Object.keys(context.kpis).length,
        contextObjectCount: context.contextObjects.length,
        recommendationsGenerated: recommendations.length,
        reportGenerated: Boolean(report),
        unavailableMetrics: context.unavailableMetrics,
      };
      if (generationStatus === 'MOCKED')
        await this.analysisRunRepository.markCompletedWithWarnings(
          payload.projectId,
          payload.analysisRunId,
          outputSummary,
        );
      else
        await this.analysisRunRepository.markCompleted(
          payload.projectId,
          payload.analysisRunId,
          outputSummary,
        );
    } catch (error) {
      if (
        error instanceof AiProviderError &&
        error.code === 'AI_PROVIDER_NOT_CONFIGURED' &&
        process.env.AI_REQUIRED !== 'true'
      ) {
        await this.analysisRunRepository.markSkipped(
          payload.projectId,
          payload.analysisRunId,
          {
            generationStatus: 'PROVIDER_NOT_CONFIGURED',
            errorMessage: error.message,
          },
        );
        return;
      }
      await this.analysisRunRepository.markFailed(
        payload.projectId,
        payload.analysisRunId,
        stage,
        error instanceof Error ? error.message : String(error),
        { correlationId: payload.correlationId },
      );
      throw error;
    }
  }

  private async buildStoredContext(payload: MarketingAiAnalysisJobPayload) {
    const [
      facts,
      overview,
      snapshot,
      semanticEntities,
      semanticRelationships,
      contextObjects,
    ] = await Promise.all([
      this.detectedFactRepository.listByProject(payload.projectId, {
        source: payload.source,
        reportType: payload.reportType,
        importId: payload.importId,
      }),
      !payload.source || payload.source.toLowerCase() === 'appsflyer'
        ? this.appsFlyerEventsRepository
            .getOverview(payload.projectId)
            .catch(() => ({}))
        : Promise.resolve({}),
      payload.importId
        ? this.appsFlyerSnapshotsRepository
            .getLatestByImport(payload.projectId, payload.importId)
            .catch(() => null)
        : Promise.resolve(null),
      this.semanticEntityRepository
        .searchEntities(payload.projectId, {
          source: payload.source,
          importId: payload.importId,
          reportType: payload.reportType,
        })
        .catch(() => []),
      this.semanticRelationshipRepository
        .searchRelationships(payload.projectId, {
          source: payload.source,
          importId: payload.importId,
          reportType: payload.reportType,
        })
        .catch(() => []),
      this.contextObjectRepository
        .searchContextObjects(payload.projectId, {
          source: payload.source,
          reportType: payload.reportType,
        })
        .catch(() => []),
    ]);
    return this.contextBuilder.buildContext({
      projectId: payload.projectId,
      source: payload.source,
      reportType: payload.reportType,
      importId: payload.importId,
      dateRange: payload.dateRange,
      facts,
      kpis: { overview, snapshot },
      unavailableMetrics: (
        overview as {
          unavailableMetrics?: Array<{ metric: string; reason: string }>;
        }
      ).unavailableMetrics,
      warnings: (overview as { warnings?: string[] }).warnings ?? [],
      semanticEntities,
      semanticRelationships,
      contextObjects,
    });
  }

  private shouldGenerateRecommendations(type: AnalysisType): boolean {
    return [
      'FULL_REPORT',
      'RECOMMENDATIONS_ONLY',
      'FACT_EXPLANATION',
      'IMPORT_SUMMARY',
      'PROJECT_SUMMARY',
    ].includes(type);
  }
  private shouldGenerateReport(type: AnalysisType): boolean {
    return [
      'FULL_REPORT',
      'REPORT_ONLY',
      'FACT_EXPLANATION',
      'IMPORT_SUMMARY',
      'PROJECT_SUMMARY',
    ].includes(type);
  }
  private reportTitle(type: AnalysisType): string {
    return `AI Marketing ${type.toLowerCase().replace(/_/g, ' ')}`;
  }
}
