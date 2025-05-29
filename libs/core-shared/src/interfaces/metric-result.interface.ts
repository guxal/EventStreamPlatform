export interface MetricResult {
    metricName: string;
    value: number;
    period: string;
    unit?: string;
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
  }
  