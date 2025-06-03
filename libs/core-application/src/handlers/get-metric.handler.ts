import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMetricQuery } from '../queries/get-metric.query';
import { MetricResult } from '@metrics-platform/core-shared';
import { Inject } from '@nestjs/common';
import { MetricsRepository } from '@metrics-platform/core-infrastructure'; // ¡Así usas la lib!

@QueryHandler(GetMetricQuery)
export class GetMetricHandler implements IQueryHandler<GetMetricQuery> {
  constructor(
    @Inject(MetricsRepository)
    private readonly metricsRepository: MetricsRepository
  ) {}

  async execute(query: GetMetricQuery): Promise<MetricResult | null> {
    const { metricName, period } = query;
    return this.metricsRepository.findOneByNameAndPeriod(metricName, period);
  }
}
