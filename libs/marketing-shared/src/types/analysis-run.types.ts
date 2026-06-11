export type AnalysisRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED' | 'SKIPPED';

export type AnalysisType = 'FULL_REPORT' | 'RECOMMENDATIONS_ONLY' | 'REPORT_ONLY' | 'FACT_EXPLANATION' | 'IMPORT_SUMMARY' | 'PROJECT_SUMMARY';

export type AnalysisRunRecord = {
  id: string;
  projectId: string;
  source?: string | null;
  reportType?: string | null;
  importId?: string | null;
  rawFileId?: string | null;
  analysisType: AnalysisType;
  provider?: string | null;
  model?: string | null;
  status: AnalysisRunStatus;
  triggeredBy?: string | null;
  inputContextSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  errorStage?: string | null;
  errorMessage?: string | null;
  errorSummary: Record<string, unknown>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisRunFilters = {
  source?: string;
  reportType?: string;
  importId?: string;
  rawFileId?: string;
  status?: AnalysisRunStatus | string;
  analysisType?: AnalysisType | string;
  from?: string;
  to?: string;
};

export type MarketingAiAnalysisJobPayload = {
  analysisRunId: string;
  projectId: string;
  source?: string;
  reportType?: string;
  importId?: string;
  rawFileId?: string;
  dateRange?: { from?: string; to?: string };
  analysisType: AnalysisType;
  provider?: string;
  model?: string;
  forceRegenerate?: boolean;
  triggeredBy?: string;
  correlationId: string;
};
