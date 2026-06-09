import axios from 'axios';

export class ClickHouseQueryClient {
  private readonly endpoint = process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HTTP_URL || '';

  async query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.endpoint || process.env.CLICKHOUSE_DISABLED === 'true') return [];
    const query = `${sql}\nFORMAT JSON`;
    const response = await axios.post(`${this.endpoint}/?query=${encodeURIComponent(query)}`, '', {
      headers: { 'Content-Type': 'text/plain' },
      validateStatus: () => true,
    });
    if (response.status < 200 || response.status >= 300) {
      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      throw new Error(`ClickHouse query failed: ${response.status} ${body}`);
    }
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    return Array.isArray(data?.data) ? data.data : [];
  }

  escape(value: string): string {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
}
