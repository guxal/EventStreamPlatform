import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ProjectAnalysisRun, ProjectAnalysisRunStatus } from '@metrics-platform/marketing-shared';
import { unwrapQueryRows } from '../../database/typeorm-query.util';

@Injectable()
export class ProjectAnalysisRunRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(input: {
    id: string;
    projectId: string;
    source: string;
    dateRangeStart?: string | null;
    dateRangeEnd?: string | null;
    status?: ProjectAnalysisRunStatus;
    triggeredBy: string;
    correlationId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ProjectAnalysisRun> {
    const rows = await this.dataSource.query(
      `INSERT INTO project_analysis_runs (id, project_id, source, date_range_start, date_range_end, status, triggered_by, correlation_id, metadata)
       VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [input.id, input.projectId, input.source, input.dateRangeStart ?? null, input.dateRangeEnd ?? null, input.status ?? 'PENDING', input.triggeredBy, input.correlationId ?? null, JSON.stringify(input.metadata ?? {})],
    );
    return this.toRecord(unwrapQueryRows<Record<string, any>>(rows)[0]!);
  }

  async findById(id: string): Promise<ProjectAnalysisRun | null> {
    const rows = await this.dataSource.query('SELECT * FROM project_analysis_runs WHERE id = $1', [id]);
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async getLatestCompleted(projectId: string, filters: { source?: string; dateRangeStart?: string | null; dateRangeEnd?: string | null } = {}): Promise<ProjectAnalysisRun | null> {
    const clauses = ['project_id = $1', `status = 'COMPLETED'`];
    const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source); clauses.push(`LOWER(source) = LOWER($${params.length})`); }
    if (filters.dateRangeStart !== undefined) { params.push(filters.dateRangeStart); clauses.push(`date_range_start IS NOT DISTINCT FROM $${params.length}::date`); }
    if (filters.dateRangeEnd !== undefined) { params.push(filters.dateRangeEnd); clauses.push(`date_range_end IS NOT DISTINCT FROM $${params.length}::date`); }
    const rows = await this.dataSource.query(`SELECT * FROM project_analysis_runs WHERE ${clauses.join(' AND ')} ORDER BY completed_at DESC NULLS LAST, created_at DESC LIMIT 1`, params);
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async listByProject(projectId: string, filters: { source?: string; status?: string } = {}): Promise<ProjectAnalysisRun[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source); clauses.push(`LOWER(source) = LOWER($${params.length})`); }
    if (filters.status) { params.push(filters.status); clauses.push(`status = $${params.length}`); }
    const rows = await this.dataSource.query(`SELECT * FROM project_analysis_runs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  async updateStatus(id: string, status: ProjectAnalysisRunStatus, metadata?: Record<string, unknown>): Promise<void> {
    const started = status === 'PROCESSING' ? ', started_at = COALESCE(started_at, NOW())' : '';
    const completed = status === 'COMPLETED' ? ', completed_at = NOW()' : '';
    await this.dataSource.query(
      `UPDATE project_analysis_runs SET status = $2, updated_at = NOW()${started}${completed}, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb WHERE id = $1`,
      [id, status, JSON.stringify(metadata ?? {})],
    );
  }

  async fail(id: string, input: { errorStage: string; errorMessage: string; errorSummary?: Record<string, unknown> }): Promise<void> {
    await this.dataSource.query(
      `UPDATE project_analysis_runs SET status = 'FAILED', completed_at = NOW(), updated_at = NOW(), error_stage = $2, error_message = $3, error_summary = $4::jsonb WHERE id = $1`,
      [id, input.errorStage, input.errorMessage, JSON.stringify(input.errorSummary ?? {})],
    );
  }

  private toRecord(row: Record<string, any>): ProjectAnalysisRun {
    return {
      id: row.id,
      projectId: row.project_id,
      source: row.source,
      dateRangeStart: row.date_range_start ? String(row.date_range_start).slice(0, 10) : null,
      dateRangeEnd: row.date_range_end ? String(row.date_range_end).slice(0, 10) : null,
      status: row.status,
      triggeredBy: row.triggered_by,
      correlationId: row.correlation_id,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      errorStage: row.error_stage,
      errorMessage: row.error_message,
      errorSummary: row.error_summary,
      metadata: row.metadata ?? {},
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }
}
