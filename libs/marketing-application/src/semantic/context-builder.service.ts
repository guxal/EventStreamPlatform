import { Injectable } from '@nestjs/common';
import { ContextObjectRepository, type ContextObjectRecord } from '@metrics-platform/marketing-infrastructure';
import type { ContextBuildResult, ContextObjectDraft, SemanticBuildInput, SourceSemanticAdapter } from './semantic.types';
import { AppsFlyerSemanticAdapter } from './appsflyer-semantic.adapter';

@Injectable()
export class ContextBuilderService {
  private readonly adapters: SourceSemanticAdapter[];

  constructor(
    private readonly contextObjectRepository: ContextObjectRepository,
    appsFlyerSemanticAdapter: AppsFlyerSemanticAdapter,
  ) {
    this.adapters = [appsFlyerSemanticAdapter];
  }

  async buildForImport(input: SemanticBuildInput): Promise<ContextBuildResult> {
    const warnings: string[] = [];
    const drafts = [...this.genericContextDrafts(input)];
    const adapter = this.adapters.find((item) => item.source.toLowerCase() === input.source.toLowerCase());
    if (adapter?.buildContextObjects) drafts.push(...(await adapter.buildContextObjects(input)));

    const contextObjects: ContextObjectRecord[] = [];
    for (const draft of this.dedupeDrafts(drafts)) {
      const contextObject = await this.contextObjectRepository.upsertContextObject({
        projectId: input.projectId,
        contextType: draft.contextType,
        title: draft.title,
        content: draft.content,
        source: draft.source ?? input.source,
        reportType: draft.reportType ?? input.reportType,
        entityId: draft.entityId,
        confidence: draft.confidence ?? 0.9,
        validFrom: draft.validFrom,
        validTo: draft.validTo,
        isSystemGenerated: draft.isSystemGenerated ?? true,
        createdBy: draft.createdBy ?? 'semantic-context-builder',
        metadata: { source: input.source, reportType: input.reportType, importId: input.importId, rawFileId: input.rawFileId, ...(draft.metadata ?? {}) },
      });
      contextObjects.push(contextObject);
    }

    if (contextObjects.length === 0) warnings.push('No context objects were generated for this import.');
    return { contextObjectsCreated: contextObjects.length, warnings, contextObjects };
  }

  private genericContextDrafts(input: SemanticBuildInput): ContextObjectDraft[] {
    const factTypes = new Set((input.facts ?? []).map((fact) => String(fact.factType)));
    const drafts: ContextObjectDraft[] = [];

    if (factTypes.has('NO_RELIABLE_COST_SOURCE')) {
      drafts.push({
        contextType: 'UNAVAILABLE_METRIC_NOTE',
        title: 'Cost metrics unavailable without reliable cost source',
        content: 'Cost-based metrics such as ROAS, CPA and CAC are unavailable because no reliable cost source was provided.',
        source: input.source,
        reportType: input.reportType,
        confidence: 1,
      });
    }

    if (factTypes.has('EVENT_REVENUE_EMPTY') || factTypes.has('EVENT_AMOUNT_IN_JSON')) {
      drafts.push({
        contextType: 'DATA_QUALITY_NOTE',
        title: 'Event monetary values may require structured payload parsing',
        content: 'Event Revenue can be empty while useful monetary values may be available inside structured event-value fields such as amount.',
        source: input.source,
        reportType: input.reportType,
        confidence: 0.95,
      });
    }

    if (factTypes.has('HIGH_BLOCKED_TRAFFIC_RATE') || factTypes.has('HIGH_BLOCKED_IN_APP_EVENTS')) {
      drafts.push({
        contextType: 'DATA_QUALITY_NOTE',
        title: 'Blocked traffic requires fraud and attribution review',
        content: 'Blocked reports represent rejected or fraud-prevention traffic and should be analyzed separately from valid conversion quality.',
        source: input.source,
        reportType: input.reportType,
        confidence: 0.95,
      });
    }

    if (this.hasPositiveMetric(input.kpis, 'firstDeposits') || factTypes.has('LOW_INSTALL_TO_FTD')) {
      drafts.push({
        contextType: 'PROJECT_PRIMARY_CONVERSION',
        title: 'First deposit treated as primary conversion when present',
        content: 'first_deposit_success is treated as the primary conversion signal when it exists in the provided event data.',
        source: input.source,
        reportType: input.reportType,
        confidence: 0.85,
      });
    }

    drafts.push({
      contextType: 'AI_ANALYSIS_SCOPE',
      title: 'AI analysis uses structured facts and semantic context only',
      content: 'AI outputs for this import are grounded in detected facts, KPI summaries, semantic entities, relationships and context objects. Original uploaded files are not sent to AI providers.',
      source: input.source,
      reportType: input.reportType,
      confidence: 1,
    });

    return drafts;
  }

  private hasPositiveMetric(kpis: Record<string, unknown> | undefined, key: string): boolean {
    return Number(kpis?.[key] ?? 0) > 0;
  }

  private dedupeDrafts(drafts: ContextObjectDraft[]): ContextObjectDraft[] {
    const seen = new Set<string>();
    return drafts.filter((draft) => {
      const key = `${draft.contextType}:${draft.title}:${draft.source ?? ''}:${draft.reportType ?? ''}:${draft.entityId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
