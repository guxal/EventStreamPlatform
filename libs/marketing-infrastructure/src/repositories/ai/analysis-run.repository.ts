import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AnalysisRunFilters, AnalysisRunRecord, AnalysisRunStatus, AnalysisType } from '@metrics-platform/marketing-shared';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';

export type CreateAnalysisRunInput = {
  id: string;
  projectId: string;
  source?: string | null;
  reportType?: string | null;
  importId?: string | null;
  rawFileId?: string | null;
  analysisType: AnalysisType;
  provider?: string | null;
  model?: string | null;
  status?: AnalysisRunStatus;
  triggeredBy?: string | null;
  inputContextSummary?: Record<string, unknown>;
};

@Injectable()
export class AnalysisRunRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(input: CreateAnalysisRunInput): Promise<AnalysisRunRecord> {
    const rows = await this.dataSource.query(
      `INSERT INTO analysis_runs (id, project_id, source, report_type, import_id, raw_file_id, analysis_type, provider, model, status, triggered_by, input_context_summary)
       VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid, $7, $8, $9, $10, $11, $12::jsonb)
       RETURNING *`,
      [input.id, input.projectId, input.source ?? null, input.reportType ?? null, input.importId ?? null, input.rawFileId ?? null, input.analysisType, input.provider ?? null, input.model ?? null, input.status ?? 'QUEUED', input.triggeredBy ?? null, JSON.stringify(input.inputContextSummary ?? {})],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async findById(projectId: string, analysisRunId: string): Promise<AnalysisRunRecord | null> {
    const rows = await this.dataSource.query('SELECT * FROM analysis_runs WHERE project_id = $1 AND id = $2 LIMIT 1', [projectId, analysisRunId]);
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async findByProject(projectId: string, filters: AnalysisRunFilters = {}): Promise<AnalysisRunRecord[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    this.addFilter(clauses, params, 'LOWER(COALESCE(source, \'\'))', filters.source?.toLowerCase());
    this.addFilter(clauses, params, 'report_type', filters.reportType);
    this.addFilter(clauses, params, 'import_id::text', filters.importId);
    this.addFilter(clauses, params, 'raw_file_id::text', filters.rawFileId);
    this.addFilter(clauses, params, 'status', filters.status);
    this.addFilter(clauses, params, 'analysis_type', filters.analysisType);
    if (filters.from) { params.push(filters.from); clauses.push(`created_at >= $${params.length}`); }
    if (filters.to) { params.push(filters.to); clauses.push(`created_at <= $${params.length}`); }
    const rows = await this.dataSource.query(`SELECT * FROM analysis_runs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  markQueued(projectId: string, id: string) { return this.updateStatus(projectId, id, 'QUEUED'); }
  markRunning(projectId: string, id: string, summary: Record<string, unknown> = {}) { return this.updateStatus(projectId, id, 'RUNNING', { started: true, inputContextSummary: summary }); }
  markCompleted(projectId: string, id: string, outputSummary: Record<string, unknown> = {}) { return this.updateStatus(projectId, id, 'COMPLETED', { completed: true, outputSummary }); }
  markCompletedWithWarnings(projectId: string, id: string, outputSummary: Record<string, unknown> = {}) { return this.updateStatus(projectId, id, 'COMPLETED_WITH_WARNINGS', { completed: true, outputSummary }); }
  markFailed(projectId: string, id: string, errorStage: string, errorMessage: string, errorSummary: Record<string, unknown> = {}) { return this.updateStatus(projectId, id, 'FAILED', { completed: true, errorStage, errorMessage, errorSummary }); }
  markSkipped(projectId: string, id: string, outputSummary: Record<string, unknown> = {}) { return this.updateStatus(projectId, id, 'SKIPPED', { completed: true, outputSummary }); }

  async updateOutputSummary(projectId: string, id: string, outputSummary: Record<string, unknown>): Promise<AnalysisRunRecord> {
    const rows = await this.dataSource.query('UPDATE analysis_runs SET output_summary = output_summary || $3::jsonb, updated_at = NOW() WHERE project_id = $1 AND id = $2 RETURNING *', [projectId, id, JSON.stringify(outputSummary)]);
    return this.toRecord(firstQueryRow(rows));
  }

  private async updateStatus(projectId: string, id: string, status: AnalysisRunStatus, options: { started?: boolean; completed?: boolean; inputContextSummary?: Record<string, unknown>; outputSummary?: Record<string, unknown>; errorStage?: string; errorMessage?: string; errorSummary?: Record<string, unknown> } = {}): Promise<AnalysisRunRecord> {
    const rows = await this.dataSource.query(
      `UPDATE analysis_runs
       SET status = $3,
           started_at = CASE WHEN $4 THEN COALESCE(started_at, NOW()) ELSE started_at END,
           completed_at = CASE WHEN $5 THEN NOW() ELSE completed_at END,
           input_context_summary = input_context_summary || $6::jsonb,
           output_summary = output_summary || $7::jsonb,
           error_stage = COALESCE($8, error_stage),
           error_message = COALESCE($9, error_message),
           error_summary = error_summary || $10::jsonb,
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, id, status, Boolean(options.started), Boolean(options.completed), JSON.stringify(options.inputContextSummary ?? {}), JSON.stringify(options.outputSummary ?? {}), options.errorStage ?? null, options.errorMessage ?? null, JSON.stringify(options.errorSummary ?? {})],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  private addFilter(clauses: string[], params: unknown[], expression: string, value?: string): void {
    if (!value) return;
    params.push(value);
    clauses.push(`${expression} = $${params.length}`);
  }

  private toRecord(row: Record<string, any>): AnalysisRunRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      source: row.source ?? null,
      reportType: row.report_type ?? null,
      importId: row.import_id ?? null,
      rawFileId: row.raw_file_id ?? null,
      analysisType: row.analysis_type,
      provider: row.provider ?? null,
      model: row.model ?? null,
      status: row.status,
      triggeredBy: row.triggered_by ?? null,
      inputContextSummary: row.input_context_summary ?? {},
      outputSummary: row.output_summary ?? {},
      errorStage: row.error_stage ?? null,
      errorMessage: row.error_message ?? null,
      errorSummary: row.error_summary ?? {},
      startedAt: row.started_at ? this.toIso(row.started_at) : null,
      completedAt: row.completed_at ? this.toIso(row.completed_at) : null,
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
