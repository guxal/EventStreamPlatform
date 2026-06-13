import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { unwrapQueryRows } from '../../database/typeorm-query.util';

export type LinkFactsToSemanticEntityInput = {
  projectId: string;
  source?: string;
  reportType?: string;
  importId?: string;
  semanticEntityId: string;
  relatedSemanticEntityIds?: string[];
  contextObjectIds?: string[];
};

@Injectable()
export class DetectedFactRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async saveMany(projectId: string, facts: DetectedFact[]): Promise<DetectedFact[]> {
    for (const fact of facts) {
      await this.dataSource.query(
        `INSERT INTO detected_facts (
           id, project_id, entity_type, fact_type, severity, confidence, temporal_context, metrics_summary, recommendation_hint,
           scope_type, scope_id, analysis_run_id, project_analysis_run_id, source, report_type, date_range_start, date_range_end
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11::uuid, $12::uuid, $13::uuid, $14, $15, $16::date, $17::date)`,
        [
          fact.id ?? randomUUID(),
          projectId,
          fact.entityType,
          fact.factType,
          fact.severity,
          fact.confidence,
          JSON.stringify(fact.temporalContext),
          JSON.stringify(fact.metricsSummary),
          fact.recommendationHint ?? null,
          fact.scopeType ?? String(fact.metricsSummary?.scopeType ?? 'IMPORT'),
          fact.scopeId ?? (typeof fact.metricsSummary?.scopeId === 'string' ? fact.metricsSummary.scopeId : null),
          this.importAnalysisRunId(fact),
          this.projectAnalysisRunId(fact),
          fact.source ?? (typeof fact.metricsSummary?.source === 'string' ? fact.metricsSummary.source : null),
          fact.reportType ?? (typeof fact.metricsSummary?.reportType === 'string' ? fact.metricsSummary.reportType : null),
          fact.dateRangeStart ?? (typeof fact.metricsSummary?.dateRangeStart === 'string' ? fact.metricsSummary.dateRangeStart : null),
          fact.dateRangeEnd ?? (typeof fact.metricsSummary?.dateRangeEnd === 'string' ? fact.metricsSummary.dateRangeEnd : null),
        ],
      );
    }
    return facts;
  }


  async deleteByScope(projectId: string, filters: { source?: string; reportType?: string; importId?: string; rawFileId?: string; scopeType?: string; scopeId?: string; dateRangeStart?: string | null; dateRangeEnd?: string | null } = {}): Promise<number> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source); clauses.push(`LOWER(COALESCE(source, metrics_summary->>'source', '')) = LOWER($${params.length})`); }
    if (filters.reportType) { params.push(filters.reportType); clauses.push(`COALESCE(report_type, metrics_summary->>'reportType') = $${params.length}`); }
    if (filters.importId) { params.push(filters.importId); clauses.push(`COALESCE(metrics_summary->>'dataImportId', metrics_summary->>'importId') = $${params.length}`); }
    if (filters.rawFileId) { params.push(filters.rawFileId); clauses.push(`metrics_summary->>'rawFileId' = $${params.length}`); }
    if (filters.scopeType) { params.push(filters.scopeType); clauses.push(`scope_type = $${params.length}`); }
    if (filters.scopeId) { params.push(filters.scopeId); clauses.push(`scope_id = $${params.length}::uuid`); }
    if (filters.dateRangeStart !== undefined) { params.push(filters.dateRangeStart); clauses.push(`date_range_start IS NOT DISTINCT FROM $${params.length}::date`); }
    if (filters.dateRangeEnd !== undefined) { params.push(filters.dateRangeEnd); clauses.push(`date_range_end IS NOT DISTINCT FROM $${params.length}::date`); }
    if (params.length === 1) return 0;
    const rows = await this.dataSource.query(`DELETE FROM detected_facts WHERE ${clauses.join(' AND ')} RETURNING id`, params);
    return unwrapQueryRows<Record<string, any>>(rows).length;
  }

  async linkFactsToSemanticEntity(input: LinkFactsToSemanticEntityInput): Promise<number> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [input.projectId];
    if (input.source) { params.push(input.source); clauses.push(`LOWER(metrics_summary->>'source') = LOWER($${params.length})`); }
    if (input.reportType) { params.push(input.reportType); clauses.push(`metrics_summary->>'reportType' = $${params.length}`); }
    if (input.importId) { params.push(input.importId); clauses.push(`metrics_summary->>'dataImportId' = $${params.length}`); }
    params.push(input.semanticEntityId, JSON.stringify(input.relatedSemanticEntityIds ?? []), JSON.stringify(input.contextObjectIds ?? []));
    const semanticParam = params.length - 2;
    const relatedParam = params.length - 1;
    const contextParam = params.length;
    const rows = await this.dataSource.query(
      `UPDATE detected_facts
       SET semantic_entity_id = COALESCE(semantic_entity_id, $${semanticParam}::uuid),
           related_semantic_entity_ids = CASE WHEN related_semantic_entity_ids = '[]'::jsonb THEN $${relatedParam}::jsonb ELSE related_semantic_entity_ids END,
           context_object_ids = CASE WHEN context_object_ids = '[]'::jsonb THEN $${contextParam}::jsonb ELSE context_object_ids END
       WHERE ${clauses.join(' AND ')}
       RETURNING id`,
      params,
    );
    return unwrapQueryRows<Record<string, any>>(rows).length;
  }

  async listByProject(projectId: string, filters: { source?: string; reportType?: string; importId?: string; rawFileId?: string; scope?: string; scopeType?: string } = {}): Promise<DetectedFact[]> {
    const rows = await this.dataSource.query('SELECT * FROM detected_facts WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return unwrapQueryRows<Record<string, any>>(rows)
      .map((row) => ({
        id: row.id,
        entityId: row.entity_id ?? projectId,
        entityType: row.entity_type,
        factType: row.fact_type,
        severity: row.severity,
        confidence: Number(row.confidence),
        temporalContext: row.temporal_context,
        metricsSummary: row.metrics_summary ?? {},
        recommendationHint: row.recommendation_hint ?? undefined,
        semanticEntityId: row.semantic_entity_id ?? undefined,
        relatedSemanticEntityIds: row.related_semantic_entity_ids ?? [],
        contextObjectIds: row.context_object_ids ?? [],
        scopeType: row.scope_type,
        scopeId: row.scope_id,
        analysisRunId: row.analysis_run_id,
        source: row.source ?? row.metrics_summary?.source,
        reportType: row.report_type ?? row.metrics_summary?.reportType,
        dateRangeStart: row.date_range_start ? String(row.date_range_start).slice(0, 10) : row.metrics_summary?.dateRangeStart,
        dateRangeEnd: row.date_range_end ? String(row.date_range_end).slice(0, 10) : row.metrics_summary?.dateRangeEnd,
      }))
      .filter((fact) => !filters.source || String(fact.metricsSummary.source ?? '').toLowerCase() === filters.source.toLowerCase())
      .filter((fact) => !filters.reportType || String(fact.metricsSummary.reportType ?? '').toLowerCase() === filters.reportType.toLowerCase())
      .filter((fact) => !filters.importId || String(fact.metricsSummary.dataImportId ?? fact.metricsSummary.importId ?? '') === filters.importId)
      .filter((fact) => !filters.rawFileId || String(fact.metricsSummary.rawFileId ?? '') === filters.rawFileId)
      .filter((fact) => !(filters.scope ?? filters.scopeType) || String(fact.scopeType ?? fact.metricsSummary.scopeType ?? '').toLowerCase() === String(filters.scope ?? filters.scopeType).toLowerCase());
  }

  private importAnalysisRunId(fact: DetectedFact): string | null {
    const scopeType = String(fact.scopeType ?? fact.metricsSummary?.scopeType ?? '').toUpperCase();
    if (scopeType === 'PROJECT') return null;
    return fact.analysisRunId ?? (typeof fact.metricsSummary?.analysisRunId === 'string' ? fact.metricsSummary.analysisRunId : null);
  }

  private projectAnalysisRunId(fact: DetectedFact): string | null {
    const scopeType = String(fact.scopeType ?? fact.metricsSummary?.scopeType ?? '').toUpperCase();
    if (scopeType !== 'PROJECT') return null;
    return fact.analysisRunId ?? (typeof fact.metricsSummary?.analysisRunId === 'string' ? fact.metricsSummary.analysisRunId : null);
  }
}
