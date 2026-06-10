import { getClickHouseConnectionConfig, resetClickHouseClientForTests } from './clickhouse-client.factory';

describe('clickhouse-client.factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetClickHouseClientForTests();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    resetClickHouseClientForTests();
  });

  it('reads ClickHouse Cloud connection settings from env', () => {
    process.env.CLICKHOUSE_URL = 'https://example.clickhouse.cloud:8443';
    process.env.CLICKHOUSE_USER = 'default';
    process.env.CLICKHOUSE_PASSWORD = 'secret';

    expect(getClickHouseConnectionConfig()).toEqual({
      url: 'https://example.clickhouse.cloud:8443',
      username: 'default',
      password: 'secret',
      disabled: false,
      enabled: true,
    });
  });

  it('disables ClickHouse when CLICKHOUSE_DISABLED=true', () => {
    process.env.CLICKHOUSE_URL = 'https://example.clickhouse.cloud:8443';
    process.env.CLICKHOUSE_DISABLED = 'true';

    expect(getClickHouseConnectionConfig().enabled).toBe(false);
  });
});
