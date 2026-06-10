import { Injectable } from '@nestjs/common';
import { ClickHouseQueryClient } from './clickhouse-query.util';

export type AppsFlyerMetricSnapshot = {
  snapshotId: string;
  projectId: string;
  importId: string | null;
  entityId: string;
  entityType: string;
  asOfDate: string;
  periodStart: string;
  periodEnd: string;
  conversions: number;
  conversionValue: number;
  contextMetadata: Record<string, unknown>;
};

@Injectable()
export class AppsFlyerSnapshotsRepository {
  private readonly client = new ClickHouseQueryClient();

  async getLatestByImport(projectId: string, importId: string): Promise<AppsFlyerMetricSnapshot | null> {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT * FROM marketing.marketing_metric_snapshots FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source_run_id = ${this.client.escape(importId)}
       ORDER BY created_at DESC LIMIT 1`,
    );
    const row = rows[0];
    return row ? this.toSnapshot(row) : null;
  }

  private toSnapshot(row: Record<string, unknown>): AppsFlyerMetricSnapshot {
    return {
      snapshotId: String(row.snapshot_id),
      projectId: String(row.project_id),
      importId: row.source_run_id ? String(row.source_run_id) : null,
      entityId: String(row.entity_id),
      entityType: String(row.entity_type),
      asOfDate: String(row.as_of_date),
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
      conversions: this.num(row.conversions),
      conversionValue: this.num(row.conversion_value),
      contextMetadata: this.parseContext(row.context_metadata),
    };
  }

  private parseContext(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value !== 'string') return value as Record<string, unknown>;
    try { return JSON.parse(value); } catch { return {}; }
  }

  private num(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
