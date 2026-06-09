import type { FactType } from '../enums/fact-type.enum';

export type AiGenerationStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED';

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
  provider?: string;
  model?: string;
  generationStatus?: AiGenerationStatus;
  relatedFactIds?: string[];
  relatedEntityIds?: string[];
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};
