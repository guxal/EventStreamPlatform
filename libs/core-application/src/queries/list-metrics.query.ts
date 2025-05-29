export class ListMetricsQuery {
    constructor(
      public readonly metricName?: string,
      public readonly fromPeriod?: string,
      public readonly toPeriod?: string
    ) {}
  }
  