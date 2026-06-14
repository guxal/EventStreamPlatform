import type { DataSource } from '../enums/data-source.enum';
import type { ReportType } from '../enums/report-type.enum';
import type { MappingProfileStatus } from '../enums/mapping-profile-status.enum';

export type ColumnMapping = Record<string, string>;
export type EventMapping = Record<string, string>;

export interface ProjectSourceMapping {
  id: string;
  projectId: string;
  source: DataSource | string;
  reportType: ReportType | string;
  version: number;
  status: MappingProfileStatus | string;
  isActive: boolean;
  columnMapping: ColumnMapping;
  eventMapping: EventMapping;
  identityStrategy: string[];
  currency?: string | null;
  timezone?: string | null;
  kpiRules: Record<string, unknown>;
  sensitiveFields: string[];
  dataQualityRules: Record<string, unknown>;
  schemaSignature?: string | null;
  headerSignature?: string | null;
  sampleFingerprint?: string | null;
  aiSuggested: boolean;
  aiConfidence?: number | null;
  userConfirmed: boolean;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MappingSuggestion {
  source: string;
  reportType: string;
  confidence: number;
  recommendedAction: 'mapping_confirmed' | 'mapping_review_required';
  columnMapping: ColumnMapping;
  eventMapping: EventMapping;
  identityStrategy: string[];
  currencyCandidates: string[];
  timezoneCandidates: string[];
  sensitiveFields: string[];
  criticalColumns: { present: string[]; missing: string[]; ambiguous: string[] };
  dataQualityWarnings: string[];
  questionsForUser: string[];
}

export interface SchemaAssistantRequest {
  projectId: string;
  rawFileId: string;
  source: string;
  reportType: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  fileName?: string;
  rowCount?: number | null;
  classificationConfidence?: number;
  existingMappings?: ProjectSourceMapping[];
}

export interface SchemaAssistantResponse extends MappingSuggestion {
  sanitizedSampleRows: Record<string, unknown>[];
}
