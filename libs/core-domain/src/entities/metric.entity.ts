import { MetricType } from '../enums/metric-type.enum';
import { MetricPeriod } from '../value-objects/metric-period.vo';

export class Metric {
  constructor(
    public readonly id: string,                 // UUID
    public readonly metricType: MetricType,
    public readonly value: number,
    public readonly period: MetricPeriod,       // día, mes, etc.
    public readonly unit?: string,
    public readonly metadata?: Record<string, any>,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  // Métodos del dominio de métricas si se requiere
}
