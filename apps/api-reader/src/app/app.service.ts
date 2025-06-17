import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetMetricQuery, ListMetricsQuery } from '@metrics-platform/core-application';

@Injectable()
export class AppService {
  constructor(private readonly queryBus: QueryBus) {}

  async handleGetMetric(metricName: string, period: string, store: 'db' | 'redis' = 'db') {
    return this.queryBus.execute(new GetMetricQuery(metricName, period, store));
  }

  async handleListMetrics(metricName?: string, fromPeriod?: string, toPeriod?: string) {
    return this.queryBus.execute(new ListMetricsQuery(metricName, fromPeriod, toPeriod));
  }
}
