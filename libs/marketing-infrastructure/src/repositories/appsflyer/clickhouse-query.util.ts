import { getClickHouseClient, isClickHouseEnabled } from '../../database/clickhouse-client.factory';

export class ClickHouseQueryClient {
  async query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!isClickHouseEnabled()) return [];

    const client = getClickHouseClient();
    if (!client) return [];

    const resultSet = await client.query({
      query: sql,
      format: 'JSON',
    });
    const payload = (await resultSet.json()) as { data?: T[] };
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  escape(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
}
