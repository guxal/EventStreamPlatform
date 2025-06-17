export class GetMetricQuery {
    constructor(
      public readonly metricName: string,
      public readonly period: string, // Ej: '2025-05'
      public readonly store: 'db' | 'redis' = 'db'
    ) {}
  }
  