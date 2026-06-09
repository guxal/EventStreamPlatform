import { Injectable } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import type { AiContextBuildFilters, AiMarketingContext } from './ai-context.types';

@Injectable()
export class AiContextBuilderService {
  buildContext(input: AiContextBuildFilters & { facts: DetectedFact[]; kpis?: Record<string, unknown>; unavailableMetrics?: Array<{ metric: string; reason: string }>; warnings?: string[]; dataQualityNotes?: string[]; semanticEntities?: unknown[]; semanticRelationships?: unknown[]; contextObjects?: unknown[] }): AiMarketingContext {
    const facts = this.filterFacts(input.facts, input).slice(0, 100).map((fact) => ({
      ...fact,
      metricsSummary: this.redactRawFields(fact.metricsSummary),
      source: String(fact.metricsSummary?.source ?? input.source ?? '').toLowerCase() || undefined,
      reportType: String(fact.metricsSummary?.reportType ?? input.reportType ?? '') || undefined,
    }));
    const sources = Array.from(new Set(facts.map((fact) => fact.source).filter(Boolean) as string[]));
    const reportTypes = Array.from(new Set(facts.map((fact) => fact.reportType).filter(Boolean) as string[]));
    return {
      projectId: input.projectId,
      sources: sources.length > 0 ? sources : input.source ? [input.source] : [],
      reportTypes: reportTypes.length > 0 ? reportTypes : input.reportType ? [input.reportType] : [],
      dateRange: input.dateRange,
      facts,
      kpis: this.safeBoundedObject(input.kpis ?? {}),
      unavailableMetrics: input.unavailableMetrics ?? this.unavailableFromFacts(facts),
      warnings: input.warnings ?? [],
      dataQualityNotes: input.dataQualityNotes ?? [],
      semanticEntities: this.safeBoundedArray(input.semanticEntities ?? []),
      semanticRelationships: this.safeBoundedArray(input.semanticRelationships ?? []),
      contextObjects: this.safeBoundedArray(input.contextObjects ?? []),
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

  private unavailableFromFacts(facts: DetectedFact[]): Array<{ metric: string; reason: string }> {
    const hasNoCost = facts.some((fact) => fact.factType === 'NO_RELIABLE_COST_SOURCE');
    return hasNoCost
      ? [
          { metric: 'roas', reason: 'No reliable cost source was provided.' },
          { metric: 'cpa', reason: 'No reliable cost source was provided.' },
          { metric: 'cac', reason: 'No reliable cost source was provided.' },
        ]
      : [];
  }

  private redactRawFields(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(input ?? {}).filter(([key]) => !key.toLowerCase().includes('raw') && !key.toLowerCase().includes('csv')));
  }

  private safeBoundedObject(input: Record<string, unknown>): Record<string, unknown> {
    const serialized = JSON.stringify(input);
    return serialized.length > 20_000 ? { truncated: true } : JSON.parse(serialized);
  }

  private safeBoundedArray(input: unknown[]): unknown[] {
    const sliced = input.slice(0, 100);
    const serialized = JSON.stringify(sliced);
    return serialized.length > 20_000 ? [{ truncated: true, originalCount: input.length }] : JSON.parse(serialized);
  }
}
