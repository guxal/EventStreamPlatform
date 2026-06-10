import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { RecommendationRecord } from '@metrics-platform/marketing-shared';
import { unwrapQueryRows } from '../../database/typeorm-query.util';

export type AiOutputListFilters = {
  source?: string;
  reportType?: string;
  importId?: string;
  priority?: string;
  generationStatus?: string;
  factType?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class RecommendationRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async saveMany(items: RecommendationRecord[]): Promise<RecommendationRecord[]> {
    for (const item of items) {
      const metadata: Record<string, unknown> = { factType: item.factType, ...(item.metadata ?? {}) };
      await this.dataSource.query(
        `INSERT INTO recommendations (
           id, project_id, title, body, priority, model_name, model_version, metadata,
           provider, source, report_type, import_id, raw_file_id, raw_ai_output, generation_status,
           error_message, related_fact_ids, related_entity_ids, confidence
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::uuid, $13::uuid, $14::jsonb, $15, $16, $17::text[], $18::text[], $19)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.projectId,
          item.title,
          item.body,
          item.priority,
          item.modelName,
          item.modelVersion,
          JSON.stringify(metadata),
          metadata.provider ?? item.provider ?? item.modelName,
          metadata.source ?? item.source ?? null,
          metadata.reportType ?? item.reportType ?? null,
          metadata.dataImportId ?? null,
          metadata.rawFileId ?? null,
          JSON.stringify(metadata.rawAiOutput ?? null),
          metadata.generationStatus ?? item.generationStatus ?? 'COMPLETED',
          metadata.errorMessage ?? item.errorMessage ?? null,
          metadata.relatedFactIds ?? item.relatedFactIds ?? [],
          metadata.relatedEntityIds ?? item.relatedEntityIds ?? [],
          metadata.confidence ?? item.confidence ?? null,
        ],
      );
    }
    return items;
  }

  async listByProject(projectId: string, filters: AiOutputListFilters = {}): Promise<RecommendationRecord[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    this.addFilter(clauses, params, 'LOWER(COALESCE(source, metadata->>\'source\', \'\'))', filters.source?.toLowerCase());
    this.addFilter(clauses, params, 'COALESCE(report_type, metadata->>\'reportType\')', filters.reportType);
    this.addFilter(clauses, params, 'COALESCE(import_id::text, metadata->>\'dataImportId\')', filters.importId);
    this.addFilter(clauses, params, 'priority', filters.priority);
    this.addFilter(clauses, params, 'COALESCE(generation_status, metadata->>\'generationStatus\')', filters.generationStatus);
    this.addFilter(clauses, params, 'COALESCE(metadata->>\'factType\', metadata->>\'fact_type\')', filters.factType);
    this.addFilter(clauses, params, 'metadata->>\'entityType\'', filters.entityType);
    this.addFilter(clauses, params, 'metadata->>\'entityId\'', filters.entityId);
    if (filters.from) { params.push(filters.from); clauses.push(`created_at >= $${params.length}`); }
    if (filters.to) { params.push(filters.to); clauses.push(`created_at <= $${params.length}`); }
    const rows = await this.dataSource.query(`SELECT * FROM recommendations WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  private addFilter(clauses: string[], params: unknown[], expression: string, value?: string): void {
    if (!value) return;
    params.push(value);
    clauses.push(`${expression} = $${params.length}`);
  }

  private toRecord(row: Record<string, any>): RecommendationRecord {
    const metadata = row.metadata ?? {};
    return {
      id: row.id,
      projectId: row.project_id,
      factType: metadata.factType,
      title: row.title,
      body: row.body,
      summary: metadata.summary ?? row.body,
      priority: row.priority,
      modelName: row.model_name ?? '',
      modelVersion: row.model_version ?? '',
      provider: row.provider ?? metadata.provider ?? row.model_name ?? '',
      model: metadata.model ?? row.model_version ?? '',
      source: row.source ?? metadata.source,
      reportType: row.report_type ?? metadata.reportType,
      generationStatus: row.generation_status ?? metadata.generationStatus ?? 'COMPLETED',
      recommendedActions: metadata.recommendedActions ?? [],
      limitations: metadata.limitations ?? [],
      relatedFactIds: row.related_fact_ids ?? metadata.relatedFactIds ?? [],
      relatedEntityIds: row.related_entity_ids ?? metadata.relatedEntityIds ?? [],
      confidence: row.confidence === null || row.confidence === undefined ? metadata.confidence : Number(row.confidence),
      errorMessage: row.error_message ?? metadata.errorMessage ?? null,
      createdAt: this.toIso(row.created_at),
      metadata,
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
