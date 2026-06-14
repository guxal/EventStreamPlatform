import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AiOutputOrchestratorService,
  ContextBuilderService,
  SemanticBuilderService,
} from '@metrics-platform/marketing-application';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import {
  ClickHouseMarketingRepository,
  DataImportRepository,
  DetectedFactRepository,
  MarketingEntityRepository,
  ObjectStorageService,
  ProcessAuditRepository,
  ProjectRepository,
  ProjectSourceMappingRepository,
  RawImportFileRepository,
} from '@metrics-platform/marketing-infrastructure';
import {
  AppsFlyerProcessingPipelineService,
  SUPPORTED_APPSFLYER_REPORT_TYPES,
} from '@metrics-platform/marketing-plugins';
import {
  DataSource,
  ImportStatus,
  RawFileStatus,
  ReportType,
  type MarketingImportProcessJobPayload,
} from '@metrics-platform/marketing-shared';
import { startQueueConsumer } from '../queue/queue.consumer';

export enum AppsFlyerProcessingErrorStage {
  PROCESS_REQUEST_VALIDATION = 'PROCESS_REQUEST_VALIDATION',
  MAPPING_PROFILE_MISSING = 'MAPPING_PROFILE_MISSING',
  BRONZE_PROFILING = 'BRONZE_PROFILING',
  SILVER_PARSING = 'SILVER_PARSING',
  SILVER_NORMALIZATION = 'SILVER_NORMALIZATION',
  SILVER_PERSISTENCE = 'SILVER_PERSISTENCE',
  GOLD_KPI_CALCULATION = 'GOLD_KPI_CALCULATION',
  GOLD_FACT_GENERATION = 'GOLD_FACT_GENERATION',
  SEMANTIC_BUILDING = 'SEMANTIC_BUILDING',
  CONTEXT_BUILDING = 'CONTEXT_BUILDING',
  AI_OUTPUT_GENERATION = 'AI_OUTPUT_GENERATION',
}

@Injectable()
export class AppsFlyerImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(AppsFlyerImportProcessor.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly rawImportFileRepository: RawImportFileRepository,
    private readonly mappingRepository: ProjectSourceMappingRepository,
    private readonly dataImportRepository: DataImportRepository,
    private readonly objectStorageService: ObjectStorageService,
    private readonly pipeline: AppsFlyerProcessingPipelineService,
    private readonly clickHouseRepository: ClickHouseMarketingRepository,
    private readonly marketingEntityRepository: MarketingEntityRepository,
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly processAuditRepository: ProcessAuditRepository,
    private readonly semanticBuilderService: SemanticBuilderService,
    private readonly contextBuilderService: ContextBuilderService,
    private readonly aiOutputOrchestrator: AiOutputOrchestratorService,
    private readonly eventProducerService: EventProducerService,
  ) {}

  onModuleInit() {
    startQueueConsumer(
      'marketing-imports',
      async (
        payload: MarketingImportProcessJobPayload,
        job?: { name?: string },
      ) => {
        if (job?.name && job.name !== 'process-marketing-import') return;
        await this.process(payload);
      },
    );
  }

  async process(payload: MarketingImportProcessJobPayload): Promise<void> {
    let auditRunId: string | null = null;
    let finalEventsCount = 0;
    let finalFactsCount = 0;
    try {
      await this.validatePayload(payload);
      const auditRun = await this.processAuditRepository.startRun({
        projectId: payload.projectId,
        dataImportId: payload.dataImportId,
        rawFileId: payload.rawFileId,
        correlationId: payload.correlationId,
        queueName: 'marketing-imports',
        jobName: 'process-marketing-import',
        triggeredBy: payload.triggeredBy,
        inputSummary: {
          source: payload.source,
          reportType: payload.reportType,
          storageUri: payload.storageUri,
          bucket: payload.bucket,
          objectKey: payload.objectKey,
        },
      });
      auditRunId = auditRun.id;

      await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.PROCESS_REQUEST_VALIDATION,
        'AppsFlyerImportProcessor.validatePayload',
        async () => ({ valid: true }),
      );

      await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.BRONZE_PROFILING,
        'RawImportFileRepository/DataImportRepository.updateStatus',
        async () => {
          await this.rawImportFileRepository.updateStatus(
            payload.projectId,
            payload.rawFileId,
            RawFileStatus.PROCESSING,
          );
          await this.dataImportRepository.updateStatus(
            payload.projectId,
            payload.dataImportId,
            ImportStatus.PROCESSING_BRONZE,
          );
          return {
            rawFileStatus: RawFileStatus.PROCESSING,
            dataImportStatus: ImportStatus.PROCESSING_BRONZE,
          };
        },
      );

      const rawFile = await this.rawImportFileRepository.findByProjectAndId(
        payload.projectId,
        payload.rawFileId,
      );
      if (!rawFile) throw new Error(`Raw file ${payload.rawFileId} not found`);
      const mappingProfile = rawFile.mappingId
        ? await this.mappingRepository.findByProjectAndId(payload.projectId, rawFile.mappingId)
        : rawFile.schemaSignature
          ? await this.mappingRepository.findActiveBySchema(payload.projectId, payload.source, payload.reportType, rawFile.schemaSignature)
          : null;
      if (!mappingProfile || !['CONFIRMED', 'ACTIVE'].includes(String(mappingProfile.status))) {
        throw new Error('MAPPING_PROFILE_MISSING: confirmed or active client mapping profile is required');
      }

      const streamResult = await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.BRONZE_PROFILING,
        'ObjectStorageService.getObjectStream',
        async () => {
          const object = await this.objectStorageService.getObjectStream({
            bucketName: payload.bucket || rawFile.bucket,
            objectKey: payload.objectKey || rawFile.objectKey,
          });
          return {
            result: object,
            summary: {
              storageUri: rawFile.storageUri,
              bucket: payload.bucket || rawFile.bucket,
              objectKey: payload.objectKey || rawFile.objectKey,
            },
          };
        },
      );

      await this.dataImportRepository.updateStatus(
        payload.projectId,
        payload.dataImportId,
        ImportStatus.PROCESSING_SILVER,
      );
      const result = await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.SILVER_PARSING,
        'AppsFlyerProcessingPipelineService.execute',
        async () => {
          const pipelineResult = await this.pipeline.execute({
            context: {
              projectId: payload.projectId,
              importId: payload.dataImportId,
              rawFileId: payload.rawFileId,
              source: payload.source,
              reportType: payload.reportType,
              fileName: rawFile.originalFileName,
              rawFile,
              mappingProfile,
            },
            stream: streamResult.stream,
            existingProfile: rawFile,
          });
          return {
            result: pipelineResult,
            summary: {
              rowsProfiled: pipelineResult.profile.rowCount,
              eventsNormalized: pipelineResult.events.length,
              factsGenerated: pipelineResult.facts.length,
              warnings: pipelineResult.warnings.length,
              services: [
                'AppsFlyerReportProfilerPlugin',
                'AppsFlyerCsvStreamParserPlugin',
                'ProjectSourceMappingRepository',
                'AppsFlyerColumnMapper',
                'AppsFlyerEventValueParserPlugin',
                'AppsFlyerNormalizerPlugin',
                'AppsFlyerEventDictionaryPlugin',
                'AppsFlyerKpiCalculatorPlugin',
                'AppsFlyerFactsPlugin',
              ],
            },
          };
        },
      );
      finalEventsCount = result.events.length;
      finalFactsCount = result.facts.length;

      await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.SILVER_PERSISTENCE,
        'ClickHouseMarketingRepository.insertMarketingEvents + MarketingEntityRepository.upsertAppsFlyerDimensions',
        async () => {
          await this.clickHouseRepository.insertMarketingEvents(result.events);
          await this.marketingEntityRepository.upsertAppsFlyerDimensions(
            payload.projectId,
            result.events,
          );
          return {
            eventsStored: result.events.length,
            dimensionsUpserted: true,
          };
        },
      );

      await this.dataImportRepository.updateStatus(
        payload.projectId,
        payload.dataImportId,
        ImportStatus.PROCESSING_GOLD,
        result.events.length,
      );
      await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.GOLD_KPI_CALCULATION,
        'ClickHouseMarketingRepository.insertMetricSnapshot',
        async () => {
          await this.clickHouseRepository.insertMetricSnapshot(
            payload.projectId,
            payload.dataImportId,
            result.kpis as unknown as Record<string, unknown>,
          );
          return {
            snapshotStored: true,
            kpiSummary: this.toKpiAuditSummary(
              result.kpis as unknown as Record<string, unknown>,
            ),
          };
        },
      );

      await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.GOLD_FACT_GENERATION,
        'DetectedFactRepository.saveMany',
        async () => {
          const enrichedFacts = result.facts.map((fact) => ({
            ...fact,
            metricsSummary: {
              ...fact.metricsSummary,
              source: payload.source,
              reportType: payload.reportType,
              dataImportId: payload.dataImportId,
              rawFileId: payload.rawFileId,
            },
          }));
          await this.detectedFactRepository.deleteByScope(payload.projectId, {
            source: payload.source,
            reportType: payload.reportType,
            importId: payload.dataImportId,
            rawFileId: payload.rawFileId,
          });
          const savedFacts = await this.detectedFactRepository.saveMany(
            payload.projectId,
            enrichedFacts,
          );
          result.facts = enrichedFacts;
          return {
            factsStored: savedFacts.length,
            factTypes: savedFacts.map((fact) => fact.factType),
          };
        },
      );

      const semanticResult = await this.runOptionalAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.SEMANTIC_BUILDING,
        'SemanticBuilderService.buildForImport',
        async () => {
          const buildResult = await this.semanticBuilderService.buildForImport({
            projectId: payload.projectId,
            source: String(payload.source).toLowerCase(),
            reportType: payload.reportType,
            importId: payload.dataImportId,
            rawFileId: payload.rawFileId,
            facts: result.facts,
            kpis: result.kpis as unknown as Record<string, unknown>,
          });
          return {
            result: buildResult,
            summary: {
              entitiesCreated: buildResult.entitiesCreated,
              relationshipsCreated: buildResult.relationshipsCreated,
              factsLinked: buildResult.factsLinked,
              warnings: buildResult.warnings,
            },
          };
        },
      );

      const contextResult = await this.runOptionalAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.CONTEXT_BUILDING,
        'ContextBuilderService.buildForImport',
        async () => {
          const buildResult = await this.contextBuilderService.buildForImport({
            projectId: payload.projectId,
            source: String(payload.source).toLowerCase(),
            reportType: payload.reportType,
            importId: payload.dataImportId,
            rawFileId: payload.rawFileId,
            facts: result.facts,
            kpis: result.kpis as unknown as Record<string, unknown>,
          });
          return {
            result: buildResult,
            summary: {
              contextObjectsCreated: buildResult.contextObjectsCreated,
              warnings: buildResult.warnings,
            },
          };
        },
      );

      await this.dataImportRepository.updateStatus(
        payload.projectId,
        payload.dataImportId,
        ImportStatus.GENERATING_AI_OUTPUTS,
        result.events.length,
      );
      await this.runAuditedStep(
        auditRunId,
        payload,
        AppsFlyerProcessingErrorStage.AI_OUTPUT_GENERATION,
        'AiOutputOrchestratorService.generateAndStore*',
        async () => {
          const aiContextExtras = {
            kpis: result.kpis as unknown as Record<string, unknown>,
            warnings: [
              ...(result.warnings ?? []),
              ...(semanticResult?.warnings ?? []),
              ...(contextResult?.warnings ?? []),
            ],
            semanticEntities: semanticResult?.semanticEntities ?? [],
            semanticRelationships: semanticResult?.semanticRelationships ?? [],
            contextObjects: contextResult?.contextObjects ?? [],
            correlationId: payload.correlationId,
            importId: payload.dataImportId,
            rawFileId: payload.rawFileId,
            source: String(payload.source).toLowerCase(),
            reportType: payload.reportType,
          };
          const recommendations =
            await this.aiOutputOrchestrator.generateAndStoreRecommendations(
              payload.projectId,
              result.facts,
              aiContextExtras,
            );
          const report = await this.aiOutputOrchestrator.generateAndStoreReport(
            payload.projectId,
            result.facts,
            aiContextExtras,
          );
          return {
            recommendationsStored: recommendations.length,
            reportStored: Boolean(report?.id),
            reportId: report?.id,
            semanticContextIncluded: Boolean(semanticResult || contextResult),
          };
        },
      );

      await this.dataImportRepository.updateStatus(
        payload.projectId,
        payload.dataImportId,
        ImportStatus.COMPLETED,
        result.events.length,
      );
      await this.rawImportFileRepository.updateStatus(
        payload.projectId,
        payload.rawFileId,
        RawFileStatus.COMPLETED,
      );
      await this.processAuditRepository.completeRun(auditRunId, {
        eventsProcessed: result.events.length,
        factsGenerated: result.facts.length,
        status: ImportStatus.COMPLETED,
      });
      await this.eventProducerService.publishProjectGoldRecompute({
        projectId: payload.projectId,
        source: 'appsflyer',
        dateRangeStart: null,
        dateRangeEnd: null,
        triggeredBy: 'post_import',
        correlationId: payload.correlationId,
        force: false,
      }).catch((error) => {
        // Post-import project analysis is complementary; do not fail the successfully processed import if enqueueing is temporarily unavailable.
        this.logger.warn({ event: 'PROJECT_GOLD_RECOMPUTE_ENQUEUE_FAILED', projectId: payload.projectId, correlationId: payload.correlationId, error: error instanceof Error ? error.message : String(error) });
      });
    } catch (error) {
      const errorStage = this.inferErrorStage(error);
      const summary = {
        errorStage,
        correlationId: payload.correlationId,
        rawFileId: payload.rawFileId,
        dataImportId: payload.dataImportId,
      };
      const message = (error as Error).message;
      await Promise.allSettled([
        this.dataImportRepository.markFailed(
          payload.projectId,
          payload.dataImportId,
          message,
          summary,
        ),
        this.rawImportFileRepository.markFailed(
          payload.projectId,
          payload.rawFileId,
          message,
          summary,
        ),
        auditRunId
          ? this.processAuditRepository.failRun(auditRunId, message, {
              ...summary,
              eventsProcessed: finalEventsCount,
              factsGenerated: finalFactsCount,
            })
          : Promise.resolve(),
      ]);
      throw error;
    }
  }

  private async runOptionalAuditedStep<T>(
    runId: string,
    payload: MarketingImportProcessJobPayload,
    stage: AppsFlyerProcessingErrorStage,
    serviceName: string,
    action: () =>
      | Promise<T | { result: T; summary?: Record<string, unknown> }>
      | T
      | { result: T; summary?: Record<string, unknown> },
  ): Promise<T | null> {
    try {
      return await this.runAuditedStep(
        runId,
        payload,
        stage,
        serviceName,
        action,
      );
    } catch (error) {
      if (process.env.SEMANTIC_CONTEXT_STRICT === 'true') throw error;
      return null;
    }
  }

  private async runAuditedStep<T>(
    runId: string,
    payload: MarketingImportProcessJobPayload,
    stage: AppsFlyerProcessingErrorStage,
    serviceName: string,
    action: () =>
      | Promise<T | { result: T; summary?: Record<string, unknown> }>
      | T
      | { result: T; summary?: Record<string, unknown> },
  ): Promise<T> {
    const step = await this.processAuditRepository.startStep({
      runId,
      projectId: payload.projectId,
      dataImportId: payload.dataImportId,
      rawFileId: payload.rawFileId,
      stage,
      serviceName,
      inputSummary: {
        correlationId: payload.correlationId,
        source: payload.source,
        reportType: payload.reportType,
      },
    });
    try {
      const value = await action();
      if (this.isAuditedResult<T>(value)) {
        await this.processAuditRepository.completeStep(
          step.id,
          value.summary ?? {},
        );
        return value.result;
      }
      await this.processAuditRepository.completeStep(
        step.id,
        this.toOutputSummary(value),
      );
      return value as T;
    } catch (error) {
      await this.processAuditRepository.failStep(
        step.id,
        (error as Error).message,
        { stage, serviceName },
      );
      throw error;
    }
  }

  private isAuditedResult<T>(
    value: unknown,
  ): value is { result: T; summary?: Record<string, unknown> } {
    return Boolean(value && typeof value === 'object' && 'result' in value);
  }

  private toOutputSummary(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private toKpiAuditSummary(
    kpis: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      totalRowsProcessed: kpis.totalRowsProcessed,
      totalNormalizedEvents: kpis.totalNormalizedEvents,
      periodStart: kpis.periodStart,
      periodEnd: kpis.periodEnd,
      conversions:
        this.number(kpis.registrations) +
        this.number(kpis.deposits) +
        this.number(kpis.firstDeposits),
      conversionValue: this.number(kpis.depositAmount),
      registrations: kpis.registrations,
      deposits: kpis.deposits,
      firstDeposits: kpis.firstDeposits,
      unavailableMetrics: kpis.unavailableMetrics,
    };
  }

  private number(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async validatePayload(
    payload: MarketingImportProcessJobPayload,
  ): Promise<void> {
    const required: (keyof MarketingImportProcessJobPayload)[] = [
      'projectId',
      'rawFileId',
      'dataImportId',
      'storageUri',
      'bucket',
      'objectKey',
      'source',
      'reportType',
      'triggeredBy',
      'correlationId',
    ];
    for (const field of required)
      if (!payload[field])
        throw new Error(
          `Invalid process-marketing-import payload: missing ${field}`,
        );
    const projectExists = await this.projectRepository.exists(
      payload.projectId,
    );
    if (!projectExists)
      throw new Error(`Project ${payload.projectId} not found`);
    const rawFile = await this.rawImportFileRepository.findByProjectAndId(
      payload.projectId,
      payload.rawFileId,
    );
    if (!rawFile)
      throw new Error(
        `Raw file ${payload.rawFileId} not found for project ${payload.projectId}`,
      );
    const dataImport = await this.dataImportRepository.findByProjectAndId(
      payload.projectId,
      payload.dataImportId,
    );
    if (!dataImport)
      throw new Error(
        `Data import ${payload.dataImportId} not found for project ${payload.projectId}`,
      );
    if (
      payload.source !== DataSource.APPSFLYER ||
      rawFile.source !== DataSource.APPSFLYER
    )
      throw new Error(`Unsupported source ${payload.source}`);
    if (
      payload.reportType === ReportType.UNKNOWN ||
      !SUPPORTED_APPSFLYER_REPORT_TYPES.has(payload.reportType)
    )
      throw new Error(
        `Unsupported AppsFlyer report type ${payload.reportType}`,
      );
  }

  private inferErrorStage(error: unknown): AppsFlyerProcessingErrorStage {
    const message = (error as Error).message ?? '';
    if (message.includes('MAPPING_PROFILE_MISSING')) return AppsFlyerProcessingErrorStage.MAPPING_PROFILE_MISSING;
    if (
      message.includes('payload') ||
      message.includes('Project') ||
      message.includes('Unsupported')
    )
      return AppsFlyerProcessingErrorStage.PROCESS_REQUEST_VALIDATION;
    if (message.includes('Semantic'))
      return AppsFlyerProcessingErrorStage.SEMANTIC_BUILDING;
    if (message.includes('Context'))
      return AppsFlyerProcessingErrorStage.CONTEXT_BUILDING;
    if (message.includes('ClickHouse') || message.includes('marketing_events'))
      return AppsFlyerProcessingErrorStage.SILVER_PERSISTENCE;
    return AppsFlyerProcessingErrorStage.SILVER_PARSING;
  }
}
