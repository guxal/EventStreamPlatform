import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import {
  DataSource,
  RawFileStatus,
  ReportType,
  type CreateRawFilePayload,
  type FileHubListFilters,
  type FileHubUploadResult,
  type ProcessRawFileResult,
  type RawImportFileRecord,
  type UpdateRawFileTagsPayload,
} from '@metrics-platform/marketing-shared';
import {
  DataImportRepository,
  ObjectStorageService,
  ProjectRepository,
  RawImportFileRepository,
} from '@metrics-platform/marketing-infrastructure';
import { FileProfilerService } from './file-profiler.service';
import { ReportClassifierService } from './report-classifier.service';

const AUTO_READY_CONFIDENCE_THRESHOLD = 0.75;

@Injectable()
export class FileHubService {
  constructor(
    private readonly objectStorageService: ObjectStorageService,
    private readonly rawImportFileRepository: RawImportFileRepository,
    private readonly dataImportRepository: DataImportRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly fileProfilerService: FileProfilerService,
    private readonly reportClassifierService: ReportClassifierService,
    private readonly eventProducerService: EventProducerService,
  ) {}

  async uploadFile(projectId: string, payload: CreateRawFilePayload): Promise<FileHubUploadResult> {
    await this.assertProjectExists(projectId);
    if (!payload.contentBase64) {
      throw new BadRequestException('contentBase64 is required');
    }

    const rawFileId = randomUUID();
    const bucketName = process.env.MARKETING_RAW_FILES_BUCKET || process.env.MARKETING_IMPORTS_BUCKET || 'marketing-imports';
    const objectKey = `${projectId}/raw-files/${rawFileId}/${payload.fileName}`;
    const storageResult = await this.objectStorageService.putObject({
      bucketName,
      objectKey,
      contentBase64: payload.contentBase64,
    });

    let rawFile = await this.rawImportFileRepository.create({
      id: rawFileId,
      projectId,
      originalFileName: payload.fileName,
      storageUri: storageResult.uri,
      bucket: bucketName,
      objectKey,
      sizeBytes: storageResult.sizeBytes,
      mimeType: payload.mimeType ?? 'text/csv',
      tags: payload.tags,
    });

    rawFile = await this.rawImportFileRepository.updateStatus(projectId, rawFileId, RawFileStatus.PROFILING);
    const profile = await this.fileProfilerService.profileStoredCsv({ bucketName, objectKey });
    rawFile = await this.rawImportFileRepository.updateProfile(projectId, rawFileId, {
      checksum: profile.checksum,
      rowCount: profile.rowCount,
      headers: profile.headers,
      sampleRows: profile.sampleRows,
      status: RawFileStatus.PROFILED,
    });

    const classification = this.reportClassifierService.classify({ fileName: payload.fileName, profile });
    const ready = this.isProcessableClassification(classification.source, classification.reportType, classification.confidence);
    rawFile = await this.rawImportFileRepository.updateClassification(projectId, rawFileId, {
      source: classification.source,
      reportType: classification.reportType,
      classificationConfidence: classification.confidence,
      needsReview: !ready,
      status: ready ? RawFileStatus.READY_TO_PROCESS : RawFileStatus.NEEDS_REVIEW,
      tags: payload.tags,
    });

    return {
      rawFile,
      profile,
      classification,
      status: rawFile.status,
    };
  }

  async listFiles(projectId: string, filters: FileHubListFilters = {}): Promise<RawImportFileRecord[]> {
    await this.assertProjectExists(projectId);
    return this.rawImportFileRepository.listByProject(projectId, {
      ...filters,
      source: filters.source ? this.normalizeSource(filters.source) : undefined,
      reportType: filters.reportType ? this.normalizeReportType(filters.reportType) : undefined,
    });
  }

  async getFile(projectId: string, fileId: string): Promise<RawImportFileRecord> {
    await this.assertProjectExists(projectId);
    const rawFile = await this.rawImportFileRepository.findByProjectAndId(projectId, fileId);
    if (!rawFile) {
      throw new NotFoundException(`Raw file ${fileId} not found for project ${projectId}`);
    }
    return rawFile;
  }

  async updateTags(projectId: string, fileId: string, payload: UpdateRawFileTagsPayload): Promise<RawImportFileRecord> {
    await this.getFile(projectId, fileId);
    const source = this.normalizeSource(payload.source);
    const reportType = this.normalizeReportType(payload.reportType ?? payload.report_type ?? ReportType.UNKNOWN);
    if (!this.hasValidManualTags(source, reportType)) {
      throw new BadRequestException('source and report_type must be known values before a file can be marked ready');
    }

    return this.rawImportFileRepository.updateClassification(projectId, fileId, {
      source,
      reportType,
      classificationConfidence: 1,
      needsReview: false,
      status: RawFileStatus.READY_TO_PROCESS,
      tags: payload.tags,
    });
  }

  async requestProcessing(projectId: string, fileId: string, triggeredBy = 'api-writer'): Promise<ProcessRawFileResult> {
    const rawFile = await this.getFile(projectId, fileId);
    if (rawFile.status !== RawFileStatus.READY_TO_PROCESS) {
      throw new BadRequestException(`Raw file ${fileId} must be READY_TO_PROCESS before processing can start`);
    }

    if (!this.hasValidManualTags(rawFile.source, rawFile.reportType)) {
      throw new BadRequestException('Unknown files cannot be processed until source and report_type are confirmed');
    }

    const dataImportId = rawFile.dataImportId ?? randomUUID();
    if (!rawFile.dataImportId) {
      await this.dataImportRepository.createForRawFile({ id: dataImportId, projectId, rawFileId: fileId });
    }

    const updatedRawFile = await this.rawImportFileRepository.attachDataImport(projectId, fileId, dataImportId);
    const jobPayload = {
      projectId,
      rawFileId: fileId,
      dataImportId,
      storageUri: rawFile.storageUri,
      source: rawFile.source,
      reportType: rawFile.reportType,
      tags: rawFile.tags,
      triggeredBy,
    };

    await this.eventProducerService.publishMarketingImport(jobPayload);

    return {
      rawFile: updatedRawFile,
      dataImportId,
      queueName: 'marketing-imports',
      jobName: 'process-marketing-import',
      payload: jobPayload,
    };
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const exists = await this.projectRepository.exists(projectId);
    if (!exists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }

  private normalizeSource(source: DataSource | string): DataSource {
    const normalized = String(source).trim().toUpperCase();
    const mapped = normalized === 'GOOGLE_ADS' || normalized === 'GOOGLE-ADS' || normalized === 'GOOGLE ADS'
      ? DataSource.GOOGLE_ADS
      : normalized === 'META_ADS' || normalized === 'META-ADS' || normalized === 'META ADS'
        ? DataSource.META_ADS
        : normalized === 'APPSFLYER'
          ? DataSource.APPSFLYER
          : DataSource.UNKNOWN;
    return mapped;
  }

  private normalizeReportType(reportType: ReportType | string): ReportType {
    const normalized = String(reportType).trim().toLowerCase().replace(/[-\s]+/g, '_');
    const values = new Set<string>(Object.values(ReportType));
    return values.has(normalized) ? (normalized as ReportType) : ReportType.UNKNOWN;
  }

  private isProcessableClassification(source: DataSource, reportType: ReportType, confidence: number): boolean {
    return this.hasValidManualTags(source, reportType) && confidence >= AUTO_READY_CONFIDENCE_THRESHOLD;
  }

  private hasValidManualTags(source: DataSource, reportType: ReportType): boolean {
    return source !== DataSource.UNKNOWN && reportType !== ReportType.UNKNOWN;
  }
}
