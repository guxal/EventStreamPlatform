import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { unwrapQueryRows } from '../../database/typeorm-query.util';

export type AppsFlyerImportSummary = {
  importId: string;
  rawFileId: string | null;
  source: string | null;
  reportType: string | null;
  status: string;
  rowsProcessed: number | null;
  eventsNormalized: number | null;
  factsGenerated: number;
  recommendationsGenerated: number;
  reportsGenerated: number;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  errorStage: string | null;
  errorMessage: string | null;
};

@Injectable()
export class DataImportsReaderRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getAppsFlyerImportSummary(projectId: string, importId: string): Promise<AppsFlyerImportSummary | null> {
    const rows = await this.dataSource.query(
      `SELECT
         di.id AS import_id,
         rif.id AS raw_file_id,
         rif.source,
         rif.report_type,
         di.status,
         di.rows_processed,
         di.started_at,
         di.finished_at,
         di.error_stage,
         di.error_message,
         (SELECT COUNT(*)::int FROM detected_facts df WHERE df.project_id = di.project_id AND df.metrics_summary->>'dataImportId' = di.id::text) AS facts_generated,
         (SELECT COUNT(*)::int FROM recommendations r WHERE r.project_id = di.project_id AND r.metadata->>'dataImportId' = di.id::text) AS recommendations_generated,
         (SELECT COUNT(*)::int FROM ai_reports ar WHERE ar.project_id = di.project_id AND ar.metadata->'dataImportIds' ? di.id::text) AS reports_generated
       FROM data_imports di
       LEFT JOIN raw_import_files rif ON rif.data_import_id = di.id OR rif.import_id = di.id
       WHERE di.project_id = $1 AND di.id = $2
       LIMIT 1`,
      [projectId, importId],
    );
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    if (!row) return null;
    return {
      importId: row.import_id,
      rawFileId: row.raw_file_id ?? null,
      source: row.source ?? null,
      reportType: row.report_type ?? null,
      status: row.status,
      rowsProcessed: row.rows_processed === null || row.rows_processed === undefined ? null : Number(row.rows_processed),
      eventsNormalized: row.rows_processed === null || row.rows_processed === undefined ? null : Number(row.rows_processed),
      factsGenerated: Number(row.facts_generated ?? 0),
      recommendationsGenerated: Number(row.recommendations_generated ?? 0),
      reportsGenerated: Number(row.reports_generated ?? 0),
      processingStartedAt: row.started_at ? this.toIso(row.started_at) : null,
      processingCompletedAt: row.finished_at ? this.toIso(row.finished_at) : null,
      errorStage: row.error_stage ?? null,
      errorMessage: row.error_message ?? null,
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
