export class CreateDynamicMetricDto {
  name!: string;
  type!: string;
  eventType!: string;
  period!: string;
  field?: string;
  filters?: Record<string, any>;
}
