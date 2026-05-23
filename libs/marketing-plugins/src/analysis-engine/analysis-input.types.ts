import type { EntityType } from '@metrics-platform/marketing-shared';

export type AnalysisMetricRow = {
  entityId: string;
  entityType: EntityType;
  periodStart: string;
  periodEnd: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  conversionRate: number;
};

export type AnalysisThresholds = {
  highSpendThreshold: number;
  lowCtrThreshold: number;
  highCpcThreshold: number;
  highCpaThreshold: number;
  lowRoasThreshold: number;
  keywordWasteSpendThreshold: number;
  scalingOpportunityRoasThreshold: number;
  scalingOpportunityConversionsThreshold: number;
};

export const DEFAULT_ANALYSIS_THRESHOLDS: AnalysisThresholds = {
  highSpendThreshold: 500,
  lowCtrThreshold: 0.01,
  highCpcThreshold: 2,
  highCpaThreshold: 40,
  lowRoasThreshold: 1.5,
  keywordWasteSpendThreshold: 100,
  scalingOpportunityRoasThreshold: 3,
  scalingOpportunityConversionsThreshold: 10,
};
