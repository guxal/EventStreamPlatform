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
        `INSERT INTO detected_facts (id, project_id, entity_type, fact_type, severity, confidence, temporal_context, metrics_summary, recommendation_hint)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
        [randomUUID(), projectId, fact.entityType, fact.factType, fact.severity, fact.confidence, JSON.stringify(fact.temporalContext), JSON.stringify(fact.metricsSummary), fact.recommendationHint ?? null],
      );
    }
    return facts;
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

  async listByProject(projectId: string, filters: { source?: string; reportType?: string } = {}): Promise<DetectedFact[]> {
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
      }))
      .filter((fact) => !filters.source || String(fact.metricsSummary.source ?? '').toLowerCase() === filters.source.toLowerCase())
      .filter((fact) => !filters.reportType || String(fact.metricsSummary.reportType ?? '').toLowerCase() === filters.reportType.toLowerCase());
  }
}
