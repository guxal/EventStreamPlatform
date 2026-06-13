export type ProjectAnalysisRunStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPUTING_KPIS'
  | 'GENERATING_FACTS'
  | 'GENERATING_AI_SUMMARY'
  | 'COMPLETED'
  | 'FAILED';

export type ProjectAnalysisTriggeredBy = 'post_import' | 'manual' | 'scheduled';

export type ProjectAnalysisScopeType = 'IMPORT' | 'PROJECT';

export type ProjectAnalysisRun = {
  id: string;
  projectId: string;
  source: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  status: ProjectAnalysisRunStatus;
  triggeredBy: ProjectAnalysisTriggeredBy | string;
  correlationId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorStage?: string | null;
  errorMessage?: string | null;
  errorSummary?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectGoldRecomputeJobPayload = {
  analysisRunId?: string;
  projectId: string;
  source: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  triggeredBy: ProjectAnalysisTriggeredBy | string;
  correlationId: string;
  force?: boolean;
};

export type ProjectDataAvailabilitySummary = {
  hasInstalls: boolean;
  hasInAppEvents: boolean;
  hasNonOrganicInAppEvents: boolean;
  hasBlockedInstalls: boolean;
  hasBlockedClicks: boolean;
  hasBlockedInAppEvents: boolean;
  hasAdRevenue: boolean;
  hasUninstalls: boolean;
  hasReliableCost: boolean;
  availableReportTypes: string[];
  missingReportTypes: string[];
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  limitations: string[];
};

export type ProjectPeriodFunnelSummary = {
  type: 'period';
  installs: number;
  installUsers: number;
  registrationUsers: number;
  depositUsers: number;
  ftdUsers: number;
  depositEvents: number;
  ftdEvents: number;
  loginUsers: number;
  engagementEvents: number;
  depositAmount: number;
  betPlacedAmount: number;
  betSettlementAmount: number;
  netBetAmountApprox: number;
  installToRegisterRate: number | null;
  installToDepositRate: number | null;
  installToFtdRate: number | null;
  identityStrategy: string;
  limitations: string[];
};

export type ProjectCohortWindowSummary = {
  registerUsers: number;
  depositUsers: number;
  ftdUsers: number;
  installToRegisterRate: number | null;
  installToDepositRate: number | null;
  installToFtdRate: number | null;
  depositAmount: number;
};

export type ProjectCohortFunnelSummary = {
  type: 'cohort';
  available: boolean;
  cohortUsers: number;
  matchedUsers: number;
  identityCoverageRate: number;
  windows: Record<string, ProjectCohortWindowSummary>;
  limitations: string[];
};

export type ProjectBlockedTrafficSummary = {
  blockedInstalls: number;
  acceptedInstalls: number;
  blockedInstallRate: number | null;
  blockedInAppEvents: number;
  acceptedInAppEvents: number;
  blockedEventRate: number | null;
  blockedReasonsDistribution: Array<{ reason: string; count: number }>;
  blockedMediaSourceDistribution: Array<{ mediaSource: string; count: number }>;
};

export type ProjectMediaSourceQualityRow = {
  mediaSource: string;
  installs: number;
  registerUsers: number;
  depositUsers: number;
  ftdUsers: number;
  depositAmount: number;
  betPlacedAmount: number;
  betSettlementAmount: number;
  blockedInstalls: number;
  blockedEvents: number;
  blockedRate: number | null;
  installToRegisterRate: number | null;
  installToDepositRate: number | null;
  installToFtdRate: number | null;
  eventVolume: number;
  conversionEventVolume: number;
  engagementEventVolume: number;
  score: number;
  rank: number;
  reasons: string[];
  limitations: string[];
};

export type ProjectMediaSourceQualitySummary = {
  rows: ProjectMediaSourceQualityRow[];
  scoringMetadata: Record<string, unknown>;
  limitations: string[];
};

export type ProjectGoldSummary = {
  projectId: string;
  source: string;
  analysisRunId?: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  dataAvailability: ProjectDataAvailabilitySummary;
  periodFunnel: ProjectPeriodFunnelSummary;
  cohortFunnel: ProjectCohortFunnelSummary;
  mediaSourceQuality: ProjectMediaSourceQualitySummary;
  campaignMetrics?: Array<Record<string, unknown>>;
  blockedTraffic: ProjectBlockedTrafficSummary;
  campaignQuality?: Array<Record<string, unknown>>;
  eventDictionaryCoverage?: Record<string, unknown>;
  dataQualitySummary?: Record<string, unknown>;
  kpis: Record<string, number | string | boolean | null>;
  limitations: string[];
  generatedAt: string;
};
