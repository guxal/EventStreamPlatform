import type { Readable } from 'stream';
import type { DataSource, DetectedFact, RawImportFileRecord, ReportType } from '@metrics-platform/marketing-shared';
import type { NormalizedAppsFlyerEvent } from '@metrics-platform/marketing-shared';

export type AppsFlyerProcessingContext = {
  projectId: string;
  integrationId?: string | null;
  importId: string;
  rawFileId: string;
  source: DataSource;
  reportType: ReportType;
  fileName?: string;
  rawFile?: RawImportFileRecord;
};

export type AppsFlyerReportProfileResult = {
  reportType: ReportType;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  isEmpty: boolean;
  exportLimitReached: boolean;
  classificationConfidence: number;
  preparedFacts: DetectedFact[];
};

export type ParsedCsvRow = {
  rowNumber: number;
  raw: Record<string, string>;
  warnings: string[];
};

export type MappedAppsFlyerRow = ParsedCsvRow & {
  canonical: Record<string, string | undefined>;
};

export type ParsedEventValueRow = MappedAppsFlyerRow & {
  eventValueJson?: Record<string, unknown> | null;
  eventAmount?: number | null;
};

export type AppsFlyerPipelineInput = {
  context: AppsFlyerProcessingContext;
  stream: Readable;
  existingProfile?: RawImportFileRecord | null;
};

export type AppsFlyerKpiResult = {
  totalRowsProcessed: number;
  totalNormalizedEvents: number;
  eventsByReportType: Record<string, number>;
  eventsByEventName: Record<string, number>;
  eventsByCanonicalEventName: Record<string, number>;
  uniqueUsers: number;
  uniqueAppsFlyerIds: number;
  uniqueCustomerUserIds: number;
  eventsByMediaSource: Record<string, number>;
  eventsByCampaign: Record<string, number>;
  eventsByCountry: Record<string, number>;
  eventsByPlatform: Record<string, number>;
  blockedEventsCount: number;
  blockedEventsRate: number | null;
  blockedClicks: number;
  blockedInAppEvents: number;
  blockedReasons: Record<string, number>;
  rejectedReasons: Record<string, number>;
  installsCount: number;
  installsByMediaSource: Record<string, number>;
  installsByCampaign: Record<string, number>;
  installsByCountry: Record<string, number>;
  installsByPlatform: Record<string, number>;
  blockedInstalls: number;
  blockedInstallRate: number | null;
  registrations: number;
  deposits: number;
  firstDeposits: number;
  depositAmount: number;
  betPlacedAmount: number;
  betSettlementAmount: number;
  approximateNetBetAmount: number;
  loginEvents: number;
  engagementEvents: number;
  eventAmountInJsonCount: number;
  eventRevenueEmptyCount: number;
  eventRevenuePresentCount: number;
  hasReliableCostSource: false;
  unavailableMetrics: Array<{ metric: string; reason: string }>;
  roas?: never;
  cpa?: never;
  installToDepositRate?: never;
  installToFtdRate?: never;
};

export type AppsFlyerPipelineResult = {
  profile: AppsFlyerReportProfileResult;
  events: NormalizedAppsFlyerEvent[];
  kpis: AppsFlyerKpiResult;
  facts: DetectedFact[];
  warnings: string[];
};
