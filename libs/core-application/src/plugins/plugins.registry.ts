// plugins.registry.ts

import { getDAUFromDB, getDAUFromRedis } from './dau.metric';
import type { MetricsRepository } from '@metrics-platform/core-infrastructure';
import type { RedisService } from '@metrics-platform/core-infrastructure';

export type MetricPluginDB = (repo: MetricsRepository, period: string) => Promise<any>;
export type MetricPluginRedis = (redis: RedisService, period: string) => Promise<any>;

export const metricsRegistry: Record<string, {
  db?: MetricPluginDB,
  redis?: MetricPluginRedis
}> = {
  DAU: {
    db: getDAUFromDB,
    redis: getDAUFromRedis,
  },
  // ...otros plugins
};
