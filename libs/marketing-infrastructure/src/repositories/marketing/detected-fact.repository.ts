import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { unwrapQueryRows } from '../../database/typeorm-query.util';

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

  async listByProject(projectId: string, filters: { source?: string; reportType?: string } = {}): Promise<DetectedFact[]> {
    const rows = await this.dataSource.query('SELECT * FROM detected_facts WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return unwrapQueryRows<Record<string, any>>(rows)
      .map((row) => ({
        entityId: row.entity_id ?? projectId,
        entityType: row.entity_type,
        factType: row.fact_type,
        severity: row.severity,
        confidence: Number(row.confidence),
        temporalContext: row.temporal_context,
        metricsSummary: row.metrics_summary ?? {},
        recommendationHint: row.recommendation_hint ?? undefined,
      }))
      .filter((fact) => !filters.source || String(fact.metricsSummary.source ?? '').toLowerCase() === filters.source.toLowerCase())
      .filter((fact) => !filters.reportType || String(fact.metricsSummary.reportType ?? '').toLowerCase() === filters.reportType.toLowerCase());
  }
}
