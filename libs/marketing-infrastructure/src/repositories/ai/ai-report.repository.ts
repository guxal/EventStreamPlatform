import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AiReportRecord } from '@metrics-platform/marketing-shared';
import { unwrapQueryRows } from '../../database/typeorm-query.util';
import type { AiOutputListFilters } from './recommendation.repository';

@Injectable()
export class AiReportRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(item: AiReportRecord): Promise<AiReportRecord> {
    const metadata = item.metadata ?? {};
    await this.dataSource.query(
      `INSERT INTO ai_reports (
         id, project_id, report_type, title, content_markdown, model_name, model_version, metadata,
         provider, source, source_report_type, import_id, raw_file_id, raw_ai_output, generation_status,
         error_message, related_fact_ids, related_entity_ids
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::uuid, $13::uuid, $14::jsonb, $15, $16, $17::text[], $18::text[])
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.projectId,
        item.reportType,
        item.title,
        item.contentMarkdown,
        item.modelName,
        item.modelVersion,
        JSON.stringify(metadata),
        metadata.provider ?? item.provider ?? item.modelName,
        metadata.source ?? item.source ?? null,
        metadata.reportType ?? item.sourceReportType ?? null,
        metadata.importId ?? (Array.isArray(metadata.dataImportIds) ? metadata.dataImportIds[0] : null) ?? null,
        metadata.rawFileId ?? null,
        JSON.stringify(metadata.rawAiOutput ?? null),
        metadata.generationStatus ?? item.generationStatus ?? 'COMPLETED',
        metadata.errorMessage ?? item.errorMessage ?? null,
        metadata.relatedFactIds ?? item.relatedFactIds ?? [],
        metadata.relatedEntityIds ?? item.relatedEntityIds ?? [],
      ],
    );
    return item;
  }

  async listByProject(projectId: string, filters: AiOutputListFilters = {}): Promise<AiReportRecord[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    this.addFilter(clauses, params, 'LOWER(COALESCE(source, metadata->>\'source\', \'\'))', filters.source?.toLowerCase());
    this.addFilter(clauses, params, 'COALESCE(source_report_type, metadata->>\'reportType\')', filters.reportType);
    this.addFilter(clauses, params, 'COALESCE(import_id::text, metadata->>\'importId\')', filters.importId);
    this.addFilter(clauses, params, 'COALESCE(generation_status, metadata->>\'generationStatus\')', filters.generationStatus);
    if (filters.from) { params.push(filters.from); clauses.push(`created_at >= $${params.length}`); }
    if (filters.to) { params.push(filters.to); clauses.push(`created_at <= $${params.length}`); }
    const rows = await this.dataSource.query(`SELECT * FROM ai_reports WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  private addFilter(clauses: string[], params: unknown[], expression: string, value?: string): void {
    if (!value) return;
    params.push(value);
    clauses.push(`${expression} = $${params.length}`);
  }

  private toRecord(row: Record<string, any>): AiReportRecord {
    const metadata = row.metadata ?? {};
    return {
      id: row.id,
      projectId: row.project_id,
      reportType: row.report_type,
      title: row.title,
      contentMarkdown: row.content_markdown,
      content: row.content_markdown,
      modelName: row.model_name ?? '',
      modelVersion: row.model_version ?? '',
      provider: row.provider ?? metadata.provider ?? row.model_name ?? '',
      model: metadata.model ?? row.model_version ?? '',
      source: row.source ?? metadata.source,
      sourceReportType: row.source_report_type ?? metadata.reportType,
      generationStatus: row.generation_status ?? metadata.generationStatus ?? 'COMPLETED',
      relatedFactIds: row.related_fact_ids ?? metadata.relatedFactIds ?? [],
      relatedEntityIds: row.related_entity_ids ?? metadata.relatedEntityIds ?? [],
      errorMessage: row.error_message ?? metadata.errorMessage ?? null,
      createdAt: this.toIso(row.created_at),
      metadata,
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
