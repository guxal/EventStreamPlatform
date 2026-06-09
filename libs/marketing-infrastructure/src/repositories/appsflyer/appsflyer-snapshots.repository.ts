import { Injectable } from '@nestjs/common';
import { ClickHouseQueryClient } from './clickhouse-query.util';

@Injectable()
export class AppsFlyerSnapshotsRepository {
  private readonly client = new ClickHouseQueryClient();

  async getLatestByImport(projectId: string, importId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT * FROM marketing.marketing_metric_snapshots FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source_run_id = ${this.client.escape(importId)}
       ORDER BY created_at DESC LIMIT 1`,
    );
    const row = rows[0];
    if (!row) return null;
    return { ...row, contextMetadata: this.parseContext(row.context_metadata) };
  }

  private parseContext(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value !== 'string') return value as Record<string, unknown>;
    try { return JSON.parse(value); } catch { return {}; }
  }
}
