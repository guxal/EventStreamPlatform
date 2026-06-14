import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource as TypeOrmDataSource } from 'typeorm';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';
import {
  DataSource,
  RawFileStatus,
  ReportType,
  type FileHubListFilters,
  type RawImportFileRecord,
  type RawImportFileTags,
} from '@metrics-platform/marketing-shared';

export type CreateRawImportFileRecordInput = {
  id: string;
  projectId: string;
  originalFileName: string;
  storageUri: string;
  bucket: string;
  objectKey: string;
  sizeBytes: number;
  mimeType?: string;
  tags?: RawImportFileTags;
};

export type UpdateRawImportFileProfileInput = {
  checksum: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  status: RawFileStatus;
};

export type UpdateRawImportFileMappingInput = {
  mappingId?: string | null;
  schemaSignature?: string | null;
  mappingStatus?: string | null;
  mappingValidation?: Record<string, unknown> | null;
  status: RawFileStatus;
  needsReview: boolean;
};

export type UpdateRawImportFileClassificationInput = {
  source: DataSource;
  reportType: ReportType;
  classificationConfidence: number;
  needsReview: boolean;
  status: RawFileStatus;
  tags?: RawImportFileTags;
};

@Injectable()
export class RawImportFileRepository {
  constructor(@InjectDataSource() private readonly dataSource: TypeOrmDataSource) {}

  async create(input: CreateRawImportFileRecordInput): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `INSERT INTO raw_import_files (
        id,
        project_id,
        original_file_name,
        original_filename,
        storage_uri,
        bucket,
        bucket_name,
        object_key,
        size_bytes,
        file_size_bytes,
        mime_type,
        content_type,
        tags,
        source,
        report_type,
        classification_confidence,
        needs_review,
        status,
        storage_provider
      ) VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, $7, $8, $8, $9::jsonb, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        input.id,
        input.projectId,
        input.originalFileName,
        input.storageUri,
        input.bucket,
        input.objectKey,
        input.sizeBytes,
        input.mimeType ?? 'text/csv',
        JSON.stringify(input.tags ?? {}),
        DataSource.UNKNOWN,
        ReportType.UNKNOWN,
        0,
        true,
        RawFileStatus.UPLOADED,
        'local',
      ],
    );

    return this.toRecord(firstQueryRow(rows));
  }

  async findByProjectAndId(projectId: string, fileId: string): Promise<RawImportFileRecord | null> {
    const rows = await this.dataSource.query(
      'SELECT * FROM raw_import_files WHERE project_id = $1 AND id = $2 LIMIT 1',
      [projectId, fileId],
    );
    const record = unwrapQueryRows<Record<string, unknown>>(rows)[0];
    return record ? this.toRecord(record) : null;
  }

  async listByProject(projectId: string, filters: FileHubListFilters = {}): Promise<RawImportFileRecord[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];

    if (filters.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }

    if (filters.source) {
      params.push(filters.source);
      clauses.push(`source = $${params.length}`);
    }

    if (filters.reportType) {
      params.push(filters.reportType);
      clauses.push(`report_type = $${params.length}`);
    }

    const rows = await this.dataSource.query(
      `SELECT * FROM raw_import_files WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );

    return unwrapQueryRows<Record<string, unknown>>(rows).map((row) => this.toRecord(row));
  }

  async updateStatus(projectId: string, fileId: string, status: RawFileStatus): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET status = $3, updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId, status],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async updateProfile(projectId: string, fileId: string, input: UpdateRawImportFileProfileInput): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET checksum = $3,
           row_count = $4,
           headers = $5::jsonb,
           sample_rows = $6::jsonb,
           status = $7,
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId, input.checksum, input.rowCount, JSON.stringify(input.headers), JSON.stringify(input.sampleRows), input.status],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async updateClassification(
    projectId: string,
    fileId: string,
    input: UpdateRawImportFileClassificationInput,
  ): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET source = $3,
           report_type = $4,
           classification_confidence = $5,
           needs_review = $6,
           status = $7,
           tags = COALESCE($8::jsonb, tags),
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        fileId,
        input.source,
        input.reportType,
        input.classificationConfidence,
        input.needsReview,
        input.status,
        input.tags === undefined ? null : JSON.stringify(input.tags),
      ],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async updateMapping(projectId: string, fileId: string, input: UpdateRawImportFileMappingInput): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET mapping_id = $3,
           schema_signature = $4,
           mapping_status = $5,
           mapping_validation = $6::jsonb,
           status = $7,
           needs_review = $8,
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId, input.mappingId ?? null, input.schemaSignature ?? null, input.mappingStatus ?? null, JSON.stringify(input.mappingValidation ?? {}), input.status, input.needsReview],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async resetForReprocess(projectId: string, fileId: string): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET status = $3,
           error_message = NULL,
           error_summary = NULL,
           error_stage = NULL,
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId, RawFileStatus.READY_TO_PROCESS],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async attachDataImport(projectId: string, fileId: string, dataImportId: string): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET data_import_id = $3,
           import_id = $3,
           status = $4,
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId, dataImportId, RawFileStatus.PROCESSING],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async deleteByProjectAndId(projectId: string, fileId: string): Promise<RawImportFileRecord | null> {
    const rows = await this.dataSource.query(
      `DELETE FROM raw_import_files
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId],
    );
    const record = unwrapQueryRows<Record<string, unknown>>(rows)[0];
    return record ? this.toRecord(record) : null;
  }

  async markFailed(projectId: string, fileId: string, errorMessage: string, errorSummary: Record<string, unknown>): Promise<RawImportFileRecord> {
    const rows = await this.dataSource.query(
      `UPDATE raw_import_files
       SET status = $3, error_message = $4, error_summary = $5::jsonb, error_stage = $6, updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, fileId, RawFileStatus.FAILED, errorMessage, JSON.stringify(errorSummary), errorSummary.errorStage ?? errorSummary.error_stage ?? null],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  private toRecord(row: Record<string, any>): RawImportFileRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      dataImportId: row.data_import_id ?? row.import_id ?? null,
      originalFileName: row.original_file_name ?? row.original_filename,
      storageUri: row.storage_uri ?? '',
      bucket: row.bucket ?? row.bucket_name,
      objectKey: row.object_key,
      sizeBytes: Number(row.size_bytes ?? row.file_size_bytes ?? 0),
      checksum: row.checksum ?? row.checksum_sha256 ?? null,
      mimeType: row.mime_type ?? row.content_type ?? null,
      rowCount: row.row_count === null || row.row_count === undefined ? null : Number(row.row_count),
      headers: Array.isArray(row.headers) ? row.headers : row.headers ?? [],
      sampleRows: Array.isArray(row.sample_rows) ? row.sample_rows : row.sample_rows ?? [],
      source: row.source ?? DataSource.UNKNOWN,
      reportType: row.report_type ?? ReportType.UNKNOWN,
      tags: row.tags ?? {},
      classificationConfidence: Number(row.classification_confidence ?? 0),
      needsReview: Boolean(row.needs_review),
      status: row.status,
      errorMessage: row.error_message ?? null,
      errorSummary: row.error_summary ?? null,
      mappingId: row.mapping_id ?? null,
      schemaSignature: row.schema_signature ?? null,
      mappingStatus: row.mapping_status ?? null,
      mappingValidation: row.mapping_validation ?? null,
      mappingResolutionType: this.mappingValidationField(row.mapping_validation, 'resolutionType'),
      mappingRequiresReview: Boolean(this.mappingValidationField(row.mapping_validation, 'requiresReview')),
      mappingValidationErrors: this.mappingValidationErrors(row.mapping_validation),
      nextAction: this.mappingValidationField(row.mapping_validation, 'nextAction'),
      mapping: {
        id: row.mapping_id ?? null,
        status: row.mapping_status ?? null,
        resolutionType: this.mappingValidationField(row.mapping_validation, 'resolutionType'),
        schemaSignature: row.schema_signature ?? null,
        requiresReview: Boolean(this.mappingValidationField(row.mapping_validation, 'requiresReview')),
        nextAction: this.mappingValidationField(row.mapping_validation, 'nextAction'),
        validationErrors: this.mappingValidationErrors(row.mapping_validation),
      },
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toIso(value: Date | string | null | undefined): string {
    if (value == null) {
      throw new Error('Expected a timestamp value but received null or undefined');
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp value: ${String(value)}`);
    }

    return date.toISOString();
  }
}
