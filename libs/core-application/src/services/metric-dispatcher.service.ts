import { Injectable } from '@nestjs/common';
import { MetricPluginDB, MetricPluginRedis, metricsRegistry } from '../plugins/plugins.registry';
import { MetricsRepository, RedisService } from '@metrics-platform/core-infrastructure';

@Injectable()
export class MetricDispatcherService {
    constructor(
        private readonly metricsRepo: MetricsRepository,
        private readonly redisService: RedisService
      ) {}
    
      async dispatch(
        metricName: keyof typeof metricsRegistry,
        period: string,
        store: 'db' | 'redis'
      ) {
        const metricEntry = metricsRegistry[metricName];
        if (!metricEntry) {
          throw new Error(`No metric registered with name ${String(metricName)}`);
        }
        const pluginFn = metricEntry[store];
        if (!pluginFn) {
          throw new Error(`No plugin found for ${String(metricName)} with store ${store}`);
        }
        // Usa el tipo correcto
        if (store === 'redis') {
          return (pluginFn as MetricPluginRedis)(this.redisService, period);
        } else {
          return (pluginFn as MetricPluginDB)(this.metricsRepo, period);
        }
      }

  async dispatchList(
    metricName: keyof typeof metricsRegistry,
    fromPeriod: string,
    toPeriod: string,
    store: 'db' | 'redis' = 'db'
  ) {
    if (store === 'redis') {
      throw new Error('Redis store not supported for list operations yet');
    }
    
    if (!metricName) {
      throw new Error('Metric name is required for list operations');
    }

    if (!fromPeriod || !toPeriod) {
      throw new Error('Both fromPeriod and toPeriod are required for list operations');
    }

    return this.metricsRepo.findByNameAndPeriodRange(metricName, fromPeriod, toPeriod);
  }
}