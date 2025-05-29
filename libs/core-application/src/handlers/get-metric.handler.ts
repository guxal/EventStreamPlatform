/* eslint-disable @typescript-eslint/no-unused-vars */
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMetricQuery } from '../queries/get-metric.query';
import { MetricResult } from '@metrics-platform/core-shared';

@QueryHandler(GetMetricQuery)
export class GetMetricHandler implements IQueryHandler<GetMetricQuery> {
  async execute(query: GetMetricQuery): Promise<MetricResult | null> {
    // const { metricName, period } = query;
    // Aquí normalmente llamas al repositorio inyectado:
    // return await this.metricsRepository.findOneByNameAndPeriod(metricName, period);
    return null; // Placeholder si no hay repo aún
  }
}
