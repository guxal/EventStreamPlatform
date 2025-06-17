import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListMetricsQuery } from '../queries/list-metrics.query';
import { MetricResult } from '@metrics-platform/core-shared';
import { MetricDispatcherService } from '../services/metric-dispatcher.service';
//import { Inject } from '@nestjs/common';
//import { MetricsRepository } from '@metrics-platform/core-infrastructure';

@QueryHandler(ListMetricsQuery)
export class ListMetricsHandler implements IQueryHandler<ListMetricsQuery> {
  constructor(private readonly dispatcher: MetricDispatcherService) {}

  async execute(query: ListMetricsQuery): Promise<MetricResult[]> {
    // Lógica real aquí
    if (!query.metricName) {
      throw new Error('Metric name is required for list operations');
    }
    if (!query.fromPeriod) {
      throw new Error('fromPeriod is required for list operations');
    }
    if (!query.toPeriod) {
      throw new Error('toPeriod is required for list operations');
    }
    return this.dispatcher.dispatchList(
      query.metricName as keyof typeof import('../plugins/plugins.registry').metricsRegistry,
      query.fromPeriod,
      query.toPeriod,
      query.store || 'db'
    );
  }
}
