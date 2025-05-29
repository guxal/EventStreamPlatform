export class CreateMetricDto {
    metricName: string | undefined;
    value: number | undefined;
    period: string | undefined; // Ej: '2025-05', '2025-05-27'
    unit?: string;
    metadata?: Record<string, any>;
  }
  