import { DataSource } from '../../enums/data-source.enum';
import { RawFileStatus } from '../../enums/raw-file-status.enum';
import { ReportType } from '../../enums/report-type.enum';
import type { FileClassificationResult } from './file-classification-result.contract';
import type { FileProfile } from './file-profile.contract';

export type RawImportFileTags = Record<string, unknown>;

export interface RawImportFileRecord {
  id: string;
  projectId: string;
  dataImportId?: string | null;
  originalFileName: string;
  storageUri: string;
  bucket: string;
  objectKey: string;
  sizeBytes: number;
  checksum?: string | null;
  mimeType?: string | null;
  rowCount?: number | null;
  headers: string[];
  sampleRows: Record<string, string>[];
  source: DataSource;
  reportType: ReportType;
  tags: RawImportFileTags;
  classificationConfidence: number;
  needsReview: boolean;
  status: RawFileStatus;
  errorMessage?: string | null;
  errorSummary?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRawFilePayload {
  fileName: string;
  contentBase64: string;
  mimeType?: string;
  tags?: RawImportFileTags;
}

export interface UpdateRawFileTagsPayload {
  source: DataSource;
  reportType?: ReportType;
  report_type?: ReportType;
  tags?: RawImportFileTags;
}

export interface FileHubUploadResult {
  rawFile: RawImportFileRecord;
  profile: FileProfile;
  classification: FileClassificationResult;
  status: RawFileStatus;
}

export interface FileHubListFilters {
  status?: RawFileStatus;
  source?: DataSource;
  reportType?: ReportType;
}

export interface ProcessRawFileResult {
  rawFile: RawImportFileRecord;
  dataImportId: string;
  queueName: 'marketing-imports';
  jobName: 'process-marketing-import';
  payload: MarketingImportProcessJobPayload;
}

export interface MarketingImportProcessJobPayload {
  projectId: string;
  rawFileId: string;
  dataImportId: string;
  storageUri: string;
  source: DataSource;
  reportType: ReportType;
  tags: RawImportFileTags;
  triggeredBy: string;
}
