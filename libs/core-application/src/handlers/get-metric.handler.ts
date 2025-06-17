import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMetricQuery } from '../queries/get-metric.query';
import { MetricDispatcherService } from '../services/metric-dispatcher.service';

@QueryHandler(GetMetricQuery)
export class GetMetricHandler implements IQueryHandler<GetMetricQuery> {
  constructor(private readonly dispatcher: MetricDispatcherService) {}

  async execute(query: GetMetricQuery) {
    // Ensure metricName is a valid key of metricsRegistry
    // This cast is safe if metricName is validated elsewhere or comes from a trusted source
    return this.dispatcher.dispatch(
      query.metricName as keyof typeof import('../plugins/plugins.registry').metricsRegistry,
      query.period,
      query.store || 'db'
    );
  }
}