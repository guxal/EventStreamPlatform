import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { MappingProfileStatus, RawFileStatus, type MappingValidationResult, type ProjectSourceMapping, type RawImportFileRecord } from '@metrics-platform/marketing-shared';
import { ProjectSourceMappingRepository, RawImportFileRepository } from '@metrics-platform/marketing-infrastructure';
import { AiSchemaAssistantService } from './ai-schema-assistant.service';
import { BuiltInSourceMappingRegistry } from './built-in-source-mapping.registry';
import { MappingValidationService } from './mapping-validation.service';

const DEFAULT_MAPPING_CONFIDENCE_THRESHOLD = Number(process.env.BUILT_IN_MAPPING_CONFIDENCE_THRESHOLD ?? 0.95);

export type MappingResolutionType = 'ATTACHED_MAPPING' | 'PROJECT_MAPPING' | 'BUILT_IN_DEFAULT' | 'AI_SUGGESTED' | 'MANUAL_REQUIRED';
export type MappingNextAction = 'READY_TO_PROCESS' | 'REVIEW_MAPPING' | 'RUN_AI_SCHEMA_ASSISTANT';
export type SchemaDetectionInput = { projectId: string; rawFileId: string; source: string; reportType: string; headers: string[]; sampleRows: Record<string,string>[]; classificationConfidence: number; tags?: Record<string, unknown>; fileName?: string; rowCount?: number | null; useAi?: boolean };

@Injectable()
export class SchemaDetectionService {
  constructor(
    private readonly mappings: ProjectSourceMappingRepository,
    private readonly rawFiles: RawImportFileRepository,
    private readonly ai: AiSchemaAssistantService,
    private readonly builtIns: BuiltInSourceMappingRegistry,
    private readonly validator: MappingValidationService,
  ) {}

  normalizeHeaders(headers: string[]): string[] { return headers.map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, '_')).sort(); }
  headerSignature(headers: string[]): string { return createHash('sha256').update(this.normalizeHeaders(headers).join('|')).digest('hex'); }
  schemaSignature(source: string, reportType: string, headers: string[]): string { return createHash('sha256').update([source, reportType, this.normalizeHeaders(headers).join('|')].join(':')).digest('hex'); }

  async analyze(input: SchemaDetectionInput) {
    const schemaSignature = this.schemaSignature(input.source, input.reportType, input.headers);
    const headerSignature = this.headerSignature(input.headers);
    const attachedRawFile = await this.rawFiles.findByProjectAndId(input.projectId, input.rawFileId).catch(() => null);

    if (attachedRawFile?.mappingId) {
      const attached = await this.mappings.findByProjectAndId(input.projectId, attachedRawFile.mappingId);
      if (attached && this.mappingMatchesFile(attached, input, schemaSignature)) {
        const validation = this.validator.validate(attached);
        if (validation.valid) return this.attachReady(input, attached, schemaSignature, validation, 'ATTACHED_MAPPING');
      }
    }

    const existing = await this.mappings.findActiveBySchema(input.projectId, input.source, input.reportType, schemaSignature);
    if (existing) {
      const validation = this.validator.validate(existing);
      if (validation.valid) return this.attachReady(input, existing, schemaSignature, validation, 'PROJECT_MAPPING');
      return this.markManualRequired(input, schemaSignature, headerSignature, validation, 'Active mapping failed validation');
    }

    const builtInResult = await this.tryBuiltInDefault(input, schemaSignature, headerSignature);
    if (builtInResult) return builtInResult;

    let rawFile: RawImportFileRecord;
    let suggestion: ProjectSourceMapping | null = null;
    if (input.useAi) {
      const ai = await this.ai.suggest({ projectId: input.projectId, rawFileId: input.rawFileId, source: input.source, reportType: input.reportType, headers: input.headers, sampleRows: input.sampleRows, fileName: input.fileName, rowCount: input.rowCount, classificationConfidence: input.classificationConfidence });
      const mapping = await this.mappings.createOrReuseSuggestion({ projectId: input.projectId, source: input.source, reportType: input.reportType, schemaSignature, headerSignature, columnMapping: ai.columnMapping, eventMapping: ai.eventMapping, identityStrategy: ai.identityStrategy, currency: ai.currencyCandidates[0] ?? null, timezone: ai.timezoneCandidates[0] ?? null, sensitiveFields: ai.sensitiveFields, aiConfidence: ai.confidence, status: MappingProfileStatus.AI_SUGGESTED, metadata: { criticalColumns: ai.criticalColumns, questionsForUser: ai.questionsForUser, createdFrom: 'AI_SCHEMA_ASSISTANT' } });
      const validation = this.reviewValidation(['Mapping requires user confirmation'], ai.dataQualityWarnings, 'AI_SUGGESTED', 'REVIEW_MAPPING');
      rawFile = await this.rawFiles.updateMapping(input.projectId, input.rawFileId, { mappingId: mapping.id, schemaSignature, mappingStatus: RawFileStatus.MAPPING_SUGGESTED, mappingValidation: validation, status: RawFileStatus.MAPPING_SUGGESTED, needsReview: true });
      suggestion = mapping;
      return this.result(input.rawFileId, schemaSignature, headerSignature, 'AI_SUGGESTED', mapping.id, true, validation, 'REVIEW_MAPPING', suggestion, rawFile);
    }

    return this.markManualRequired(input, schemaSignature, headerSignature, this.reviewValidation(['No active or built-in mapping profile for schema'], [], 'MANUAL_REQUIRED', 'RUN_AI_SCHEMA_ASSISTANT'));
  }

  private async tryBuiltInDefault(input: SchemaDetectionInput, schemaSignature: string, headerSignature: string) {
    if (input.classificationConfidence < DEFAULT_MAPPING_CONFIDENCE_THRESHOLD) return null;
    const builtIn = this.builtIns.get(input.source, input.reportType);
    if (!builtIn || !this.builtIns.isCompatible(builtIn, input.headers)) return null;
    const materialized = this.builtIns.materializeForHeaders(builtIn, input.headers);
    const candidate = {
      projectId: input.projectId,
      source: input.source,
      reportType: input.reportType,
      version: 1,
      status: MappingProfileStatus.ACTIVE,
      isActive: true,
      columnMapping: materialized.columnMapping,
      eventMapping: materialized.eventMapping,
      identityStrategy: materialized.identityStrategy,
      currency: materialized.currency,
      timezone: materialized.timezone,
      kpiRules: materialized.kpiRules,
      sensitiveFields: materialized.sensitiveFields,
      dataQualityRules: materialized.dataQualityRules,
      schemaSignature,
      headerSignature,
      sampleFingerprint: null,
      aiSuggested: false,
      aiConfidence: null,
      userConfirmed: false,
      metadata: { createdFrom: 'BUILT_IN_DEFAULT_MAPPING', defaultFamily: `${input.source}:${input.reportType}` },
      id: 'built-in-candidate',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    } satisfies ProjectSourceMapping;
    const validation = this.validator.validate(candidate);
    if (!validation.valid) return null;
    const mapping = await this.mappings.createOrReuseBuiltInDefault(candidate);
    return this.attachReady(input, mapping, schemaSignature, validation, 'BUILT_IN_DEFAULT');
  }

  private async attachReady(input: SchemaDetectionInput, mapping: ProjectSourceMapping, schemaSignature: string, validation: MappingValidationResult, resolutionType: MappingResolutionType) {
    const enrichedValidation = this.reviewValidation(validation.errors, validation.warnings, resolutionType, 'READY_TO_PROCESS', false);
    const rawFile = await this.rawFiles.updateMapping(input.projectId, input.rawFileId, { mappingId: mapping.id, schemaSignature, mappingStatus: RawFileStatus.MAPPING_CONFIRMED, mappingValidation: enrichedValidation, status: RawFileStatus.READY_TO_PROCESS, needsReview: false });
    return this.result(input.rawFileId, schemaSignature, mapping.headerSignature ?? null, resolutionType, mapping.id, false, enrichedValidation, 'READY_TO_PROCESS', mapping, rawFile);
  }

  private async markManualRequired(input: SchemaDetectionInput, schemaSignature: string, headerSignature: string, validation: MappingValidationResult & Record<string, unknown>, reason?: string) {
    const enrichedValidation = { ...validation, reason: reason ?? validation.reason };
    const rawFile = await this.rawFiles.updateMapping(input.projectId, input.rawFileId, { mappingId: null, schemaSignature, mappingStatus: RawFileStatus.MAPPING_REQUIRED, mappingValidation: enrichedValidation, status: RawFileStatus.MAPPING_REQUIRED, needsReview: true });
    return this.result(input.rawFileId, schemaSignature, headerSignature, 'MANUAL_REQUIRED', null, true, enrichedValidation, 'RUN_AI_SCHEMA_ASSISTANT', null, rawFile);
  }

  private mappingMatchesFile(mapping: ProjectSourceMapping, input: SchemaDetectionInput, schemaSignature: string): boolean {
    return mapping.projectId === input.projectId && String(mapping.source) === input.source && String(mapping.reportType) === input.reportType && (!mapping.schemaSignature || mapping.schemaSignature === schemaSignature);
  }

  private reviewValidation(errors: string[], warnings: string[], resolutionType: MappingResolutionType, nextAction: MappingNextAction, requiresReview = true) {
    return { valid: errors.length === 0 && !requiresReview, errors, warnings, resolutionType, requiresReview, nextAction };
  }

  private result(rawFileId: string, schemaSignature: string, headerSignature: string | null, resolutionType: MappingResolutionType, mappingId: string | null, requiresReview: boolean, validation: Record<string, unknown>, nextAction: MappingNextAction, mapping: ProjectSourceMapping | null, rawFile: RawImportFileRecord) {
    return { rawFileId, schemaSignature, headerSignature, resolutionType, mappingId, mappingStatus: mapping?.status ?? null, mapping, validation, requiresReview, nextAction, rawFile };
  }
}
