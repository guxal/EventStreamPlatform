import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type AiDebugTraceRecordInput = {
  correlationId: string;
  projectId?: string | null;
  importId?: string | null;
  rawFileId?: string | null;
  source?: string | null;
  reportType?: string | null;
  aiFlow?: string | null;
  promptType?: string | null;
  model?: string | null;
  contextSummary?: Record<string, unknown> | null;
  sanitizedPrompt?: unknown;
  sanitizedResponse?: string | null;
  parsedOutput?: unknown;
  errorType?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  tokenUsage?: Record<string, unknown> | null;
};

@Injectable()
export class AiDebugTraceRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(input: AiDebugTraceRecordInput): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO ai_debug_traces (
        id, correlation_id, project_id, import_id, raw_file_id, source, report_type,
        ai_flow, prompt_type, model, context_summary, sanitized_prompt, sanitized_response,
        parsed_output, error_type, error_message, duration_ms, token_usage
      ) VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15, $16, $17, $18::jsonb)`,
      [
        randomUUID(),
        input.correlationId,
        input.projectId ?? null,
        input.importId ?? null,
        input.rawFileId ?? null,
        input.source ?? null,
        input.reportType ?? null,
        input.aiFlow ?? null,
        input.promptType ?? null,
        input.model ?? null,
        JSON.stringify(input.contextSummary ?? null),
        JSON.stringify(input.sanitizedPrompt ?? null),
        input.sanitizedResponse ?? null,
        JSON.stringify(input.parsedOutput ?? null),
        input.errorType ?? null,
        input.errorMessage ?? null,
        input.durationMs ?? null,
        JSON.stringify(input.tokenUsage ?? null),
      ],
    );
  }
}
