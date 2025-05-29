import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListMetricsQuery } from '../queries/list-metrics.query';
import { MetricResult } from '@metrics-platform/core-shared';

@QueryHandler(ListMetricsQuery)
export class ListMetricsHandler implements IQueryHandler<ListMetricsQuery> {
  async execute(query: ListMetricsQuery): Promise<MetricResult[]> {
    // const { metricName, fromPeriod, toPeriod } = query;
    // Aquí llamarías al repositorio inyectado para buscar métricas por rango/período
    // return await this.metricsRepository.findByRange(metricName, fromPeriod, toPeriod);
    return []; // Placeholder
  }
}
