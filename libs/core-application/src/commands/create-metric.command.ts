import { CreateMetricDto } from '@metrics-platform/core-shared';

export class CreateMetricCommand {
  constructor(public readonly payload: CreateMetricDto) {}
}
