import type { FactType } from '../enums/fact-type.enum';

export type AiGenerationStatus = 'MOCKED' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'PROVIDER_NOT_CONFIGURED';

export type RecommendationRecord = {
  id: string;
  projectId: string;
  factType: FactType;
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  modelName: string;
  modelVersion: string;
  createdAt: string;
  source?: string;
  reportType?: string;
  analysisRunId?: string;
  importId?: string;
  rawFileId?: string;
  provider?: string;
  model?: string;
  generationStatus?: AiGenerationStatus;
  summary?: string;
  recommendedActions?: string[];
  limitations?: string[];
  relatedFactIds?: string[];
  relatedEntityIds?: string[];
  confidence?: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type AiReportRecord = {
  id: string;
  projectId: string;
  reportType: 'WEEKLY' | 'CUSTOM' | string;
  title: string;
  contentMarkdown: string;
  content?: string;
  modelName: string;
  modelVersion: string;
  createdAt: string;
  source?: string;
  sourceReportType?: string;
  analysisRunId?: string;
  importId?: string;
  rawFileId?: string;
  provider?: string;
  model?: string;
  generationStatus?: AiGenerationStatus;
  relatedFactIds?: string[];
  relatedEntityIds?: string[];
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};
