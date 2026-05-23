import type { FactType } from '@metrics-platform/marketing-shared';

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
};

export type AiReportRecord = {
  id: string;
  projectId: string;
  reportType: 'WEEKLY' | 'CUSTOM';
  title: string;
  contentMarkdown: string;
  modelName: string;
  modelVersion: string;
  createdAt: string;
};
