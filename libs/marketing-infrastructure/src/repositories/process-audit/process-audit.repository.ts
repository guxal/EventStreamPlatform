import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';

export type MarketingProcessStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';
export type MarketingProcessStepStatus = MarketingProcessStatus | 'SKIPPED';

export type MarketingProcessRunRecord = {
  id: string;
  projectId: string;
  dataImportId: string | null;
  rawFileId: string | null;
  correlationId: string | null;
  queueName: string;
  jobName: string;
  status: MarketingProcessStatus;
  currentStage: string | null;
  triggeredBy: string | null;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  errorMessage: string | null;
  errorSummary: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
  steps?: MarketingProcessStepRecord[];
};

export type MarketingProcessStepRecord = {
  id: string;
  runId: string;
  projectId: string;
  dataImportId: string | null;
  rawFileId: string | null;
  stage: string;
  serviceName: string;
  status: MarketingProcessStepStatus;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  errorMessage: string | null;
  errorSummary: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
};

@Injectable()
export class ProcessAuditRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async startRun(input: {
    projectId: string;
    dataImportId: string;
    rawFileId: string;
    correlationId?: string;
    queueName: string;
    jobName: string;
    triggeredBy?: string;
    inputSummary?: Record<string, unknown>;
  }): Promise<MarketingProcessRunRecord> {
    const id = randomUUID();
    const rows = await this.dataSource.query(
      `INSERT INTO marketing_process_runs (id, project_id, data_import_id, raw_file_id, correlation_id, queue_name, job_name, status, triggered_by, input_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'RUNNING', $8, $9::jsonb)
       RETURNING *`,
      [id, input.projectId, input.dataImportId, input.rawFileId, input.correlationId ?? null, input.queueName, input.jobName, input.triggeredBy ?? null, JSON.stringify(input.inputSummary ?? {})],
    );
    return this.toRunRecord(firstQueryRow(rows));
  }

  async startStep(input: {
    runId: string;
    projectId: string;
    dataImportId: string;
    rawFileId: string;
    stage: string;
    serviceName: string;
    inputSummary?: Record<string, unknown>;
  }): Promise<MarketingProcessStepRecord> {
    const id = randomUUID();
    const rows = await this.dataSource.query(
      `INSERT INTO marketing_process_steps (id, run_id, project_id, data_import_id, raw_file_id, stage, service_name, status, input_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'RUNNING', $8::jsonb)
       RETURNING *`,
      [id, input.runId, input.projectId, input.dataImportId, input.rawFileId, input.stage, input.serviceName, JSON.stringify(input.inputSummary ?? {})],
    );
    await this.dataSource.query('UPDATE marketing_process_runs SET current_stage = $2, updated_at = NOW() WHERE id = $1', [input.runId, input.stage]);
    return this.toStepRecord(firstQueryRow(rows));
  }

  async completeStep(stepId: string, outputSummary: Record<string, unknown> = {}): Promise<void> {
    await this.dataSource.query(
      `UPDATE marketing_process_steps
       SET status = 'COMPLETED', output_summary = $2::jsonb, finished_at = NOW(), duration_ms = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int), updated_at = NOW()
       WHERE id = $1`,
      [stepId, JSON.stringify(outputSummary)],
    );
  }

  async failStep(stepId: string, errorMessage: string, errorSummary: Record<string, unknown> = {}): Promise<void> {
    await this.dataSource.query(
      `UPDATE marketing_process_steps
       SET status = 'FAILED', error_message = $2, error_summary = $3::jsonb, finished_at = NOW(), duration_ms = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int), updated_at = NOW()
       WHERE id = $1`,
      [stepId, errorMessage, JSON.stringify(errorSummary)],
    );
  }

  async completeRun(runId: string, outputSummary: Record<string, unknown> = {}): Promise<void> {
    await this.dataSource.query(
      `UPDATE marketing_process_runs
       SET status = 'COMPLETED', current_stage = 'COMPLETED', output_summary = $2::jsonb, finished_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [runId, JSON.stringify(outputSummary)],
    );
  }

  async failRun(runId: string, errorMessage: string, errorSummary: Record<string, unknown> = {}): Promise<void> {
    await this.dataSource.query(
      `UPDATE marketing_process_runs
       SET status = 'FAILED', error_message = $2, error_summary = $3::jsonb, finished_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [runId, errorMessage, JSON.stringify(errorSummary)],
    );
  }

  async listRunsByProject(projectId: string, limit = 50): Promise<MarketingProcessRunRecord[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM marketing_process_runs WHERE project_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [projectId, Math.min(Math.max(limit, 1), 200)],
    );
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRunRecord(row));
  }

  async getRunWithSteps(projectId: string, runId: string): Promise<MarketingProcessRunRecord | null> {
    const runRows = await this.dataSource.query('SELECT * FROM marketing_process_runs WHERE project_id = $1 AND id = $2 LIMIT 1', [projectId, runId]);
    const run = unwrapQueryRows<Record<string, any>>(runRows)[0];
    if (!run) return null;
    const stepRows = await this.dataSource.query('SELECT * FROM marketing_process_steps WHERE run_id = $1 ORDER BY started_at ASC', [runId]);
    return { ...this.toRunRecord(run), steps: unwrapQueryRows<Record<string, any>>(stepRows).map((row) => this.toStepRecord(row)) };
  }

  async getLatestRunByImport(projectId: string, dataImportId: string): Promise<MarketingProcessRunRecord | null> {
    const rows = await this.dataSource.query(
      `SELECT * FROM marketing_process_runs WHERE project_id = $1 AND data_import_id = $2 ORDER BY started_at DESC LIMIT 1`,
      [projectId, dataImportId],
    );
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.getRunWithSteps(projectId, row.id) : null;
  }

  private toRunRecord(row: Record<string, any>): MarketingProcessRunRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      dataImportId: row.data_import_id ?? null,
      rawFileId: row.raw_file_id ?? null,
      correlationId: row.correlation_id ?? null,
      queueName: row.queue_name,
      jobName: row.job_name,
      status: row.status,
      currentStage: row.current_stage ?? null,
      triggeredBy: row.triggered_by ?? null,
      inputSummary: row.input_summary ?? {},
      outputSummary: row.output_summary ?? {},
      errorMessage: row.error_message ?? null,
      errorSummary: row.error_summary ?? null,
      startedAt: this.toIso(row.started_at),
      finishedAt: row.finished_at ? this.toIso(row.finished_at) : null,
    };
  }

  private toStepRecord(row: Record<string, any>): MarketingProcessStepRecord {
    return {
      id: row.id,
      runId: row.run_id,
      projectId: row.project_id,
      dataImportId: row.data_import_id ?? null,
      rawFileId: row.raw_file_id ?? null,
      stage: row.stage,
      serviceName: row.service_name,
      status: row.status,
      inputSummary: row.input_summary ?? {},
      outputSummary: row.output_summary ?? {},
      errorMessage: row.error_message ?? null,
      errorSummary: row.error_summary ?? null,
      startedAt: this.toIso(row.started_at),
      finishedAt: row.finished_at ? this.toIso(row.finished_at) : null,
      durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
