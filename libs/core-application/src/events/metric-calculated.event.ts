import { Metric } from '@metrics-platform/core-domain';

export class MetricCalculatedEvent {
  constructor(public readonly metric: Metric) {}
}
