import type { DetectedFact } from '@metrics-platform/marketing-shared';

export type AiContextBuildFilters = {
  projectId: string;
  source?: string;
  reportType?: string;
  importId?: string;
  dateRange?: { from?: string; to?: string };
  entityType?: string;
  entityId?: string;
  factType?: string;
  maxFacts?: number;
  maxEntities?: number;
  maxRelationships?: number;
  maxContextObjects?: number;
};

export type AiMarketingContext = {
  projectId: string;
  sources: string[];
  reportTypes: string[];
  dateRange?: { from?: string; to?: string };
  facts: Array<DetectedFact & { id?: string; source?: string; reportType?: string }>;
  kpis: Record<string, unknown>;
  unavailableMetrics: Array<{ metric: string; reason: string }>;
  warnings: string[];
  dataQualityNotes: string[];
  semanticEntities: unknown[];
  semanticRelationships: unknown[];
  contextObjects: unknown[];
};
