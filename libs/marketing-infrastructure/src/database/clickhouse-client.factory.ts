import { createClient, type ClickHouseClient } from '@clickhouse/client';

export type ClickHouseConnectionConfig = {
  url: string;
  username: string;
  password: string;
  disabled: boolean;
  enabled: boolean;
};

let cachedClient: ClickHouseClient | null | undefined;

export function getClickHouseConnectionConfig(): ClickHouseConnectionConfig {
  const url = (process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HTTP_URL || '').trim();
  const username = (process.env.CLICKHOUSE_USER || process.env.CLICKHOUSE_USERNAME || 'default').trim();
  const password = process.env.CLICKHOUSE_PASSWORD || '';
  const disabled = process.env.CLICKHOUSE_DISABLED === 'true';

  return {
    url,
    username,
    password,
    disabled,
    enabled: Boolean(url) && !disabled,
  };
}

export function isClickHouseEnabled(): boolean {
  return getClickHouseConnectionConfig().enabled;
}

export function getClickHouseClient(): ClickHouseClient | null {
  const config = getClickHouseConnectionConfig();
  if (!config.enabled) {
    return null;
  }

  if (cachedClient === undefined) {
    cachedClient = createClient({
      url: config.url,
      username: config.username,
      password: config.password,
    });
  }

  return cachedClient;
}

export function resetClickHouseClientForTests(): void {
  cachedClient = undefined;
}
