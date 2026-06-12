import { Injectable } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import type { AiContextBuildFilters, AiMarketingContext } from './ai-context.types';

@Injectable()
export class AiContextBuilderService {
  buildContext(input: AiContextBuildFilters & { facts: DetectedFact[]; kpis?: Record<string, unknown>; unavailableMetrics?: Array<{ metric: string; reason: string }>; warnings?: string[]; dataQualityNotes?: string[]; semanticEntities?: unknown[]; semanticRelationships?: unknown[]; contextObjects?: unknown[]; projectName?: string }): AiMarketingContext {
    const facts = this.filterFacts(input.facts, input).slice(0, input.maxFacts ?? 50).map((fact) => ({
      ...fact,
      metricsSummary: this.safeBoundedObject(this.redactRawFields(fact.metricsSummary)),
      source: String(fact.metricsSummary?.source ?? input.source ?? '').toLowerCase() || undefined,
      reportType: String(fact.metricsSummary?.reportType ?? input.reportType ?? '') || undefined,
    }));
    const sources = Array.from(new Set(facts.map((fact) => fact.source).filter(Boolean) as string[]));
    const reportTypes = Array.from(new Set(facts.map((fact) => fact.reportType).filter(Boolean) as string[]));
    const kpis = this.safeBoundedObject(this.redactRawFields(input.kpis ?? {}));
    const unavailableMetrics = input.unavailableMetrics ?? this.unavailableFromFacts(facts, input.source);
    return {
      projectId: input.projectId,
      project: { id: input.projectId, name: input.projectName },
      scope: { source: input.source ?? sources[0], reportTypes: reportTypes.length > 0 ? reportTypes : input.reportType ? [input.reportType] : [], dateRange: input.dateRange, importId: input.importId },
      dataAvailability: this.dataAvailability(facts, kpis, sources),
      limitations: this.limitationsFromUnavailable(unavailableMetrics),
      sources: sources.length > 0 ? sources : input.source ? [input.source] : [],
      reportTypes: reportTypes.length > 0 ? reportTypes : input.reportType ? [input.reportType] : [],
      dateRange: input.dateRange,
      facts,
      kpis,
      unavailableMetrics,
      warnings: input.warnings ?? [],
      dataQualityNotes: input.dataQualityNotes ?? [],
      semanticEntities: this.safeBoundedArray(this.redactRawArray(input.semanticEntities ?? []), input.maxEntities ?? 50),
      semanticRelationships: this.safeBoundedArray(this.redactRawArray(input.semanticRelationships ?? []), input.maxRelationships ?? 100),
      contextObjects: this.safeBoundedArray(this.redactRawArray(input.contextObjects ?? []), input.maxContextObjects ?? 30),
    };
  }

  private filterFacts(facts: DetectedFact[], filters: AiContextBuildFilters): DetectedFact[] {
    return facts
      .filter((fact) => !filters.source || String(fact.metricsSummary?.source ?? '').toLowerCase() === filters.source.toLowerCase())
      .filter((fact) => !filters.reportType || String(fact.metricsSummary?.reportType ?? '') === filters.reportType)
      .filter((fact) => !filters.importId || String(fact.metricsSummary?.dataImportId ?? '') === filters.importId)
      .filter((fact) => !filters.entityType || String(fact.entityType) === filters.entityType)
      .filter((fact) => !filters.entityId || String(fact.entityId) === filters.entityId)
      .filter((fact) => !filters.factType || String(fact.factType) === filters.factType);
  }

  private unavailableFromFacts(facts: Array<DetectedFact & { source?: string }>, source?: string): Array<{ metric: string; reason: string }> {
    const hasAppsFlyer = facts.some((fact) => fact.source === 'appsflyer') || source?.toLowerCase() === 'appsflyer';
    const hasNoCost = facts.some((fact) => String(fact.factType) === 'NO_RELIABLE_COST_SOURCE') || hasAppsFlyer;
    return hasNoCost
      ? [
          { metric: 'roas', reason: 'No reliable cost source was provided.' },
          { metric: 'cpa', reason: 'No reliable cost source was provided.' },
          { metric: 'cac', reason: 'No reliable cost source was provided.' },
        ]
      : [];
  }

  private dataAvailability(facts: Array<DetectedFact & { source?: string; reportType?: string }>, kpis: Record<string, unknown>, sources: string[]): Record<string, boolean> {
    const factTypes = new Set(facts.map((fact) => String(fact.factType)));
    const reportTypes = new Set(facts.map((fact) => String(fact.reportType ?? '').toLowerCase()));
    const serializedKpis = JSON.stringify(kpis).toLowerCase();
    return {
      hasAppsflyer: sources.includes('appsflyer') || facts.some((fact) => fact.source === 'appsflyer'),
      hasGoogleAdsCost: sources.includes('google_ads') || sources.includes('googleads') || serializedKpis.includes('google'),
      hasReliableCost: !factTypes.has('NO_RELIABLE_COST_SOURCE') && (serializedKpis.includes('cost') || serializedKpis.includes('spend')),
      hasInstalls: reportTypes.has('installs') || serializedKpis.includes('install'),
      hasInAppEvents: reportTypes.has('in_app_events') || serializedKpis.includes('event'),
      hasBlockedTraffic: factTypes.has('HIGH_BLOCKED_TRAFFIC_RATE') || factTypes.has('HIGH_BLOCKED_IN_APP_EVENTS') || serializedKpis.includes('blocked'),
      hasEventRevenueEmptyFact: factTypes.has('EVENT_REVENUE_EMPTY'),
      hasEventAmountInJsonFact: factTypes.has('EVENT_AMOUNT_IN_JSON'),
    };
  }

  private limitationsFromUnavailable(unavailableMetrics: Array<{ metric: string; reason: string }>): string[] {
    return unavailableMetrics.map((metric) => `${metric.metric}: ${metric.reason}`);
  }

  private redactRawArray(input: unknown[]): unknown[] {
    return input.map((item) => this.redactRawValue(item));
  }

  private redactRawFields(input: Record<string, unknown>): Record<string, unknown> {
    return this.redactRawValue(input) as Record<string, unknown>;
  }

  private redactRawValue(input: unknown): unknown {
    if (Array.isArray(input)) return input.slice(0, 100).map((item) => this.redactRawValue(item));
    if (!input || typeof input !== 'object') return input;
    return Object.fromEntries(Object.entries(input as Record<string, unknown>)
      .filter(([key]) => !this.isForbiddenKey(key))
      .map(([key, value]) => [key, this.redactRawValue(value)]));
  }

  private isForbiddenKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return ['raw', 'csv', 'payload', 'device', 'advertising_id', 'idfa', 'gaid', 'user_id', 'customer_user_id'].some((token) => normalized.includes(token));
  }

  private safeBoundedObject(input: Record<string, unknown>): Record<string, unknown> {
    const serialized = JSON.stringify(input);
    return serialized.length > 20_000 ? { truncated: true } : JSON.parse(serialized);
  }

  private safeBoundedArray(input: unknown[], maxItems: number): unknown[] {
    const sliced = input.slice(0, maxItems);
    const serialized = JSON.stringify(sliced);
    return serialized.length > 20_000 ? [{ truncated: true, originalCount: input.length }] : JSON.parse(serialized);
  }
}
