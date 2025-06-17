export class ListMetricsQuery {
    constructor(
      public readonly metricName?: string,
      public readonly fromPeriod?: string,
      public readonly toPeriod?: string,
      public readonly store: 'db' | 'redis' = 'db'
    ) {}
  }
  