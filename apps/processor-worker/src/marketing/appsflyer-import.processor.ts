import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiOutputOrchestratorService } from '@metrics-platform/marketing-application';
import {
  ClickHouseMarketingRepository,
  DataImportRepository,
  DetectedFactRepository,
  MarketingEntityRepository,
  ObjectStorageService,
  ProjectRepository,
  RawImportFileRepository,
} from '@metrics-platform/marketing-infrastructure';
import { AppsFlyerProcessingPipelineService, SUPPORTED_APPSFLYER_REPORT_TYPES } from '@metrics-platform/marketing-plugins';
import { DataSource, ImportStatus, RawFileStatus, ReportType, type MarketingImportProcessJobPayload } from '@metrics-platform/marketing-shared';
import { startQueueConsumer } from '../queue/queue.consumer';

export enum AppsFlyerProcessingErrorStage {
  PROCESS_REQUEST_VALIDATION = 'PROCESS_REQUEST_VALIDATION',
  BRONZE_PROFILING = 'BRONZE_PROFILING',
  SILVER_PARSING = 'SILVER_PARSING',
  SILVER_NORMALIZATION = 'SILVER_NORMALIZATION',
  SILVER_PERSISTENCE = 'SILVER_PERSISTENCE',
  GOLD_KPI_CALCULATION = 'GOLD_KPI_CALCULATION',
  GOLD_FACT_GENERATION = 'GOLD_FACT_GENERATION',
  AI_OUTPUT_GENERATION = 'AI_OUTPUT_GENERATION',
}

@Injectable()
export class AppsFlyerImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(AppsFlyerImportProcessor.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly rawImportFileRepository: RawImportFileRepository,
    private readonly dataImportRepository: DataImportRepository,
    private readonly objectStorageService: ObjectStorageService,
    private readonly pipeline: AppsFlyerProcessingPipelineService,
    private readonly clickHouseRepository: ClickHouseMarketingRepository,
    private readonly marketingEntityRepository: MarketingEntityRepository,
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly aiOutputOrchestrator: AiOutputOrchestratorService,
  ) {}

  onModuleInit() {
    startQueueConsumer('marketing-imports', async (payload: MarketingImportProcessJobPayload, job?: { name?: string }) => {
      if (job?.name && job.name !== 'process-marketing-import') return;
      await this.process(payload);
    });
  }

  async process(payload: MarketingImportProcessJobPayload): Promise<void> {
    try {
      await this.validatePayload(payload);
      await this.rawImportFileRepository.updateStatus(payload.projectId, payload.rawFileId, RawFileStatus.PROCESSING);
      await this.dataImportRepository.updateStatus(payload.projectId, payload.dataImportId, ImportStatus.PROCESSING_BRONZE);

      const rawFile = await this.rawImportFileRepository.findByProjectAndId(payload.projectId, payload.rawFileId);
      if (!rawFile) throw new Error(`Raw file ${payload.rawFileId} not found`);
      const streamResult = await this.objectStorageService.getObjectStream({ bucketName: payload.bucket || rawFile.bucket, objectKey: payload.objectKey || rawFile.objectKey });

      await this.dataImportRepository.updateStatus(payload.projectId, payload.dataImportId, ImportStatus.PROCESSING_SILVER);
      const result = await this.pipeline.execute({
        context: {
          projectId: payload.projectId,
          importId: payload.dataImportId,
          rawFileId: payload.rawFileId,
          source: payload.source,
          reportType: payload.reportType,
          fileName: rawFile.originalFileName,
          rawFile,
        },
        stream: streamResult.stream,
        existingProfile: rawFile,
      });

      await this.clickHouseRepository.insertMarketingEvents(result.events);
      await this.marketingEntityRepository.upsertAppsFlyerDimensions(payload.projectId, result.events);

      await this.dataImportRepository.updateStatus(payload.projectId, payload.dataImportId, ImportStatus.PROCESSING_GOLD, result.events.length);
      await this.clickHouseRepository.insertMetricSnapshot(payload.projectId, payload.dataImportId, result.kpis as unknown as Record<string, unknown>);
      await this.detectedFactRepository.saveMany(payload.projectId, result.facts);

      await this.dataImportRepository.updateStatus(payload.projectId, payload.dataImportId, ImportStatus.GENERATING_AI_OUTPUTS, result.events.length);
      try {
        this.aiOutputOrchestrator.generateAndStoreRecommendations(payload.projectId, result.facts);
        this.aiOutputOrchestrator.generateAndStoreReport(payload.projectId, result.facts);
      } catch (error) {
        this.logger.warn(`AI output generation skipped for import ${payload.dataImportId}: ${(error as Error).message}`);
      }

      await this.dataImportRepository.updateStatus(payload.projectId, payload.dataImportId, ImportStatus.COMPLETED, result.events.length);
      await this.rawImportFileRepository.updateStatus(payload.projectId, payload.rawFileId, RawFileStatus.COMPLETED);
    } catch (error) {
      const errorStage = this.inferErrorStage(error);
      const summary = { errorStage, correlationId: payload.correlationId, rawFileId: payload.rawFileId, dataImportId: payload.dataImportId };
      const message = (error as Error).message;
      await Promise.allSettled([
        this.dataImportRepository.markFailed(payload.projectId, payload.dataImportId, message, summary),
        this.rawImportFileRepository.markFailed(payload.projectId, payload.rawFileId, message, summary),
      ]);
      throw error;
    }
  }

  private async validatePayload(payload: MarketingImportProcessJobPayload): Promise<void> {
    const required: (keyof MarketingImportProcessJobPayload)[] = ['projectId', 'rawFileId', 'dataImportId', 'storageUri', 'bucket', 'objectKey', 'source', 'reportType', 'triggeredBy', 'correlationId'];
    for (const field of required) if (!payload[field]) throw new Error(`Invalid process-marketing-import payload: missing ${field}`);
    const projectExists = await this.projectRepository.exists(payload.projectId);
    if (!projectExists) throw new Error(`Project ${payload.projectId} not found`);
    const rawFile = await this.rawImportFileRepository.findByProjectAndId(payload.projectId, payload.rawFileId);
    if (!rawFile) throw new Error(`Raw file ${payload.rawFileId} not found for project ${payload.projectId}`);
    const dataImport = await this.dataImportRepository.findByProjectAndId(payload.projectId, payload.dataImportId);
    if (!dataImport) throw new Error(`Data import ${payload.dataImportId} not found for project ${payload.projectId}`);
    if (payload.source !== DataSource.APPSFLYER || rawFile.source !== DataSource.APPSFLYER) throw new Error(`Unsupported source ${payload.source}`);
    if (payload.reportType === ReportType.UNKNOWN || !SUPPORTED_APPSFLYER_REPORT_TYPES.has(payload.reportType)) throw new Error(`Unsupported AppsFlyer report type ${payload.reportType}`);
  }

  private inferErrorStage(error: unknown): AppsFlyerProcessingErrorStage {
    const message = (error as Error).message ?? '';
    if (message.includes('payload') || message.includes('Project') || message.includes('Unsupported')) return AppsFlyerProcessingErrorStage.PROCESS_REQUEST_VALIDATION;
    if (message.includes('ClickHouse') || message.includes('marketing_events')) return AppsFlyerProcessingErrorStage.SILVER_PERSISTENCE;
    return AppsFlyerProcessingErrorStage.SILVER_PARSING;
  }
}
