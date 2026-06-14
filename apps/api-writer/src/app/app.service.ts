import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { AnalysisRunRepository, DataImportRepository, ProjectAnalysisRunRepository, ProjectRepository, RawImportFileRepository } from '@metrics-platform/marketing-infrastructure';
import { FileHubService, ProjectSourceMappingService, SchemaDetectionService, AiSchemaAssistantService } from '@metrics-platform/marketing-application';
import { ObjectStorageService } from '@metrics-platform/marketing-infrastructure';
import { CreateEventCommand } from '@metrics-platform/core-application';
import { CreateEventDto } from '@metrics-platform/core-shared';
import type {
  AnalysisType,
  CreateRawFilePayload,
  FileHubListFilters,
  UpdateRawFileTagsPayload,
} from '@metrics-platform/marketing-shared';
import type { CreateImportPayload, CreateProjectPayload, DataImportRecord, ProjectRecord } from './projects.types';

@Injectable()
export class AppService {
  private readonly imports = new Map<string, DataImportRecord[]>();

  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventProducerService: EventProducerService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly projectRepository: ProjectRepository,
    private readonly fileHubService: FileHubService,
    private readonly mappingService: ProjectSourceMappingService,
    private readonly schemaDetectionService: SchemaDetectionService,
    private readonly aiSchemaAssistantService: AiSchemaAssistantService,
    private readonly analysisRunRepository: AnalysisRunRepository,
    private readonly projectAnalysisRunRepository: ProjectAnalysisRunRepository,
    private readonly dataImportRepository: DataImportRepository,
    private readonly rawImportFileRepository: RawImportFileRepository,
  ) {}

  async handleCreateEvent(dto: CreateEventDto) {
    return this.commandBus.execute(new CreateEventCommand(dto));
  }

  async createProject(payload: CreateProjectPayload): Promise<ProjectRecord> {
    return this.projectRepository.create({
      id: randomUUID(),
      name: payload.name,
      description: payload.description,
      defaultCurrency: payload.defaultCurrency ?? 'USD',
      timezone: payload.timezone ?? 'UTC',
    });
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.projectRepository.list();
  }

  async createProjectImport(projectId: string, payload: CreateImportPayload): Promise<DataImportRecord> {
    const projectExists = await this.projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const importId = randomUUID();
    const bucketName = process.env.MARKETING_IMPORTS_BUCKET || 'marketing-imports';
    const objectKey = `${projectId}/${importId}/${payload.fileName}`;

    const contentBase64 = payload.contentBase64 || '';
    const storageResult = contentBase64
      ? await this.objectStorageService.putObject({ bucketName, objectKey, contentBase64 })
      : { uri: '', sizeBytes: 0 };

    const dataImport: DataImportRecord = {
      id: importId,
      projectId,
      fileName: payload.fileName,
      storageProvider: (process.env.MARKETING_STORAGE_PROVIDER as 'minio' | 's3') || 'minio',
      bucketName,
      objectKey,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      sizeBytes: storageResult.sizeBytes,
      storageUri: storageResult.uri,
    };

    const existing = this.imports.get(projectId) ?? [];
    existing.push(dataImport);
    this.imports.set(projectId, existing);

    await this.eventProducerService.publishMarketingImport({
      importId,
      projectId,
      fileName: payload.fileName,
      contentBase64,
      contentType: payload.contentType || 'text/csv',
      storageProvider: dataImport.storageProvider,
      bucketName,
      objectKey,
      createdAt: dataImport.createdAt,
      traceId: randomUUID(),
    });

    return dataImport;
  }

  async listProjectImports(projectId: string): Promise<DataImportRecord[]> {
    const projectExists = await this.projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.imports.get(projectId) ?? [];
  }

  uploadProjectFile(projectId: string, payload: CreateRawFilePayload) {
    return this.fileHubService.uploadFile(projectId, payload);
  }

  listProjectFiles(projectId: string, filters: FileHubListFilters) {
    return this.fileHubService.listFiles(projectId, filters);
  }

  getProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.getFile(projectId, fileId);
  }

  deleteProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.deleteFile(projectId, fileId);
  }

  updateProjectFileTags(projectId: string, fileId: string, payload: UpdateRawFileTagsPayload) {
    return this.fileHubService.updateTags(projectId, fileId, payload);
  }

  processProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.requestProcessing(projectId, fileId, 'api-writer');
  }

  reprocessProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.reprocessFile(projectId, fileId, 'api-writer');
  }


  listMappings(projectId: string, filters: { source?: string; reportType?: string; status?: string }) { return this.mappingService.list(projectId, filters); }
  getMapping(projectId: string, mappingId: string) { return this.mappingService.get(projectId, mappingId); }
  createMapping(projectId: string, payload: any) { return this.mappingService.create(projectId, payload); }
  updateMapping(projectId: string, mappingId: string, payload: any) { return this.mappingService.update(projectId, mappingId, payload); }
  confirmMapping(projectId: string, mappingId: string, confirmedBy?: string) { return this.mappingService.confirm(projectId, mappingId, confirmedBy); }
  applyMappingToFile(projectId: string, fileId: string, mappingId: string) { return this.mappingService.applyToFile(projectId, fileId, mappingId); }
  async analyzeFileSchema(projectId: string, fileId: string, payload: { useAi?: boolean }) {
    const rawFile = await this.fileHubService.getFile(projectId, fileId);
    return this.schemaDetectionService.analyze({ projectId, rawFileId: fileId, source: rawFile.source, reportType: rawFile.reportType, headers: rawFile.headers, sampleRows: rawFile.sampleRows, classificationConfidence: rawFile.classificationConfidence, tags: rawFile.tags, fileName: rawFile.originalFileName, rowCount: rawFile.rowCount, useAi: Boolean(payload.useAi) });
  }
  async suggestFileSchema(projectId: string, fileId: string) {
    const rawFile = await this.fileHubService.getFile(projectId, fileId);
    return this.aiSchemaAssistantService.suggest({ projectId, rawFileId: fileId, source: rawFile.source, reportType: rawFile.reportType, headers: rawFile.headers, sampleRows: rawFile.sampleRows, fileName: rawFile.originalFileName, rowCount: rawFile.rowCount, classificationConfidence: rawFile.classificationConfidence });
  }

  async recomputeProjectGold(projectId: string, payload: { source?: string; dateRangeStart?: string; dateRangeEnd?: string; force?: boolean }) {
    if (!(await this.projectRepository.exists(projectId))) throw new NotFoundException(`Project ${projectId} not found`);
    const source = (payload.source ?? 'appsflyer').toLowerCase();
    if (source !== 'appsflyer') throw new Error(`Unsupported project analysis source ${payload.source}`);
    const analysisRunId = randomUUID();
    const correlationId = randomUUID();
    const run = await this.projectAnalysisRunRepository.create({ id: analysisRunId, projectId, source, dateRangeStart: payload.dateRangeStart ?? null, dateRangeEnd: payload.dateRangeEnd ?? null, status: 'PENDING', triggeredBy: 'manual', correlationId, metadata: { force: Boolean(payload.force) } });
    const job = await this.eventProducerService.publishProjectGoldRecompute({ analysisRunId, projectId, source, dateRangeStart: payload.dateRangeStart ?? null, dateRangeEnd: payload.dateRangeEnd ?? null, triggeredBy: 'manual', correlationId, force: Boolean(payload.force) });
    return { analysisRunId: run.id, status: run.status, jobId: job?.id, correlationId, job: { queue: 'project-analysis', name: 'recompute-project-gold' } };
  }

  async createAnalysisRun(projectId: string, payload: { source?: string; reportType?: string; importId?: string; rawFileId?: string; dateRange?: { from?: string; to?: string }; analysisType: AnalysisType; provider?: string; model?: string; forceRegenerate?: boolean }) {
    if (!(await this.projectRepository.exists(projectId))) throw new NotFoundException(`Project ${projectId} not found`);
    const validTypes = new Set(['FULL_REPORT', 'RECOMMENDATIONS_ONLY', 'REPORT_ONLY', 'FACT_EXPLANATION', 'IMPORT_SUMMARY', 'PROJECT_SUMMARY']);
    if (!validTypes.has(payload.analysisType)) throw new Error(`Unsupported analysisType ${payload.analysisType}`);
    if (payload.source && !['appsflyer', 'google_ads', 'meta_ads'].includes(payload.source.toLowerCase())) throw new Error(`Unsupported source ${payload.source}`);
    if (payload.importId && !(await this.dataImportRepository.findByProjectAndId(projectId, payload.importId))) throw new NotFoundException(`Import ${payload.importId} not found for project ${projectId}`);
    if (payload.rawFileId && !(await this.rawImportFileRepository.findByProjectAndId(projectId, payload.rawFileId))) throw new NotFoundException(`Raw file ${payload.rawFileId} not found for project ${projectId}`);
    const analysisRunId = randomUUID();
    const correlationId = randomUUID();
    const run = await this.analysisRunRepository.create({ id: analysisRunId, projectId, source: payload.source, reportType: payload.reportType, importId: payload.importId, rawFileId: payload.rawFileId, analysisType: payload.analysisType, provider: payload.provider, model: payload.model, status: 'QUEUED', triggeredBy: 'manual', inputContextSummary: { dateRange: payload.dateRange, forceRegenerate: payload.forceRegenerate } });
    const jobPayload = { analysisRunId, projectId, source: payload.source, reportType: payload.reportType, importId: payload.importId, rawFileId: payload.rawFileId, dateRange: payload.dateRange, analysisType: payload.analysisType, provider: payload.provider, model: payload.model, forceRegenerate: payload.forceRegenerate, triggeredBy: 'manual', correlationId };
    await this.eventProducerService.publishMarketingAnalysis(jobPayload);
    return { analysisRunId: run.id, status: run.status, source: run.source, reportType: run.reportType, analysisType: run.analysisType, provider: run.provider, job: { queue: 'marketing-analysis', name: 'generate-ai-analysis', correlationId } };
  }
}
