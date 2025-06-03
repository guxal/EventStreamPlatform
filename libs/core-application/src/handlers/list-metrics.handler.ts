import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListMetricsQuery } from '../queries/list-metrics.query';
import { MetricResult } from '@metrics-platform/core-shared';
import { Inject } from '@nestjs/common';
import { MetricsRepository } from '@metrics-platform/core-infrastructure';

@QueryHandler(ListMetricsQuery)
export class ListMetricsHandler implements IQueryHandler<ListMetricsQuery> {
  constructor(
    @Inject(MetricsRepository)
    private readonly metricsRepository: MetricsRepository
  ) {}

  async execute(query: ListMetricsQuery): Promise<MetricResult[]> {
    const { metricName, fromPeriod, toPeriod } = query;
    if (!metricName || !fromPeriod || !toPeriod) {
      throw new Error('metricName, fromPeriod, and toPeriod are required parameters');
    }
    return this.metricsRepository.findByRange(metricName, fromPeriod, toPeriod);
  }
}
