import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ImportStatus } from '@metrics-platform/marketing-shared';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';

export type DataImportRecord = {
  id: string;
  projectId: string;
  status: ImportStatus | 'PROCESSING';
  errorMessage?: string | null;
  createdAt: string;
};

@Injectable()
export class DataImportRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createForRawFile(input: { id: string; projectId: string; rawFileId: string; status?: ImportStatus }): Promise<DataImportRecord> {
    const rows = await this.dataSource.query(
      `INSERT INTO data_imports (id, project_id, import_type, status, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [input.id, input.projectId, 'CSV', input.status ?? ImportStatus.PENDING],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async findByProjectAndId(projectId: string, importId: string): Promise<DataImportRecord | null> {
    const rows = await this.dataSource.query('SELECT * FROM data_imports WHERE project_id = $1 AND id = $2 LIMIT 1', [projectId, importId]);
    const row = unwrapQueryRows<Record<string, unknown>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async updateStatus(projectId: string, importId: string, status: ImportStatus | 'PROCESSING', rowsProcessed?: number): Promise<DataImportRecord> {
    const finished = status === ImportStatus.COMPLETED || status === ImportStatus.FAILED;
    const rows = await this.dataSource.query(
      `UPDATE data_imports
       SET status = $3, rows_processed = COALESCE($4, rows_processed), finished_at = CASE WHEN $5 THEN NOW() ELSE finished_at END, updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, importId, this.toDatabaseStatus(status), rowsProcessed ?? null, finished],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async markFailed(projectId: string, importId: string, errorMessage: string, errorSummary: Record<string, unknown>): Promise<DataImportRecord> {
    const rows = await this.dataSource.query(
      `UPDATE data_imports
       SET status = $3, error_message = $4, error_stage = $5, error_summary = $6::jsonb, finished_at = NOW(), updated_at = NOW(), rows_failed = COALESCE(rows_failed, 0) + 1
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, importId, ImportStatus.FAILED, errorMessage, errorSummary.errorStage ?? errorSummary.error_stage ?? null, JSON.stringify(errorSummary)],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  private toDatabaseStatus(status: ImportStatus | 'PROCESSING'): string {
    return status;
  }

  private toRecord(row: Record<string, any>): DataImportRecord {
    return { id: row.id, projectId: row.project_id, status: row.status, errorMessage: row.error_message ?? null, createdAt: this.toIso(row.created_at) };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
