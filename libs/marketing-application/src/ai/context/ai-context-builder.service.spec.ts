import { EntityType, FactType, Severity } from '@metrics-platform/marketing-shared';
import { AiContextBuilderService } from './ai-context-builder.service';

describe('AiContextBuilderService', () => {
  it('excludes raw CSV and includes facts/unavailable metrics', () => {
    const context = new AiContextBuilderService().buildContext({
      projectId: 'project-1',
      source: 'appsflyer',
      reportType: 'installs',
      facts: [{
        entityId: 'project-1',
        entityType: EntityType.ACCOUNT,
        factType: FactType.NO_RELIABLE_COST_SOURCE,
        severity: Severity.INFO,
        confidence: 0.99,
        temporalContext: { lookbackDays: 0, startDate: '2026-06-01', endDate: '2026-06-01' },
        metricsSummary: { source: 'APPSFLYER', reportType: 'installs', rawCsv: 'SHOULD_NOT_BE_INCLUDED' },
      }],
    });
    expect(JSON.stringify(context)).not.toContain('raw CSV');
    expect(context.facts).toHaveLength(1);
    expect(context.unavailableMetrics.some((metric) => metric.metric === 'roas')).toBe(true);
  });

  it('supports source/reportType filters', () => {
    const context = new AiContextBuilderService().buildContext({
      projectId: 'project-1',
      source: 'appsflyer',
      reportType: 'installs',
      facts: [
        { entityId: '1', entityType: EntityType.ACCOUNT, factType: FactType.EMPTY_REPORT, severity: Severity.INFO, confidence: 1, temporalContext: { lookbackDays: 0, startDate: 'x', endDate: 'x' }, metricsSummary: { source: 'APPSFLYER', reportType: 'installs' } },
        { entityId: '1', entityType: EntityType.ACCOUNT, factType: FactType.EMPTY_REPORT, severity: Severity.INFO, confidence: 1, temporalContext: { lookbackDays: 0, startDate: 'x', endDate: 'x' }, metricsSummary: { source: 'GOOGLE_ADS', reportType: 'campaigns' } },
      ],
    });
    expect(context.facts).toHaveLength(1);
    expect(context.sources).toEqual(['appsflyer']);
  });

  it('includes bounded semantic and context data when provided', () => {
    const context = new AiContextBuilderService().buildContext({
      projectId: 'project-1',
      source: 'appsflyer',
      facts: [],
      semanticEntities: [{ entityType: 'campaign', canonicalName: 'campaign x' }],
      semanticRelationships: [{ relationshipType: 'CAMPAIGN_HAS_EVENT' }],
      contextObjects: [{ contextType: 'UNAVAILABLE_METRIC_NOTE', title: 'Cost unavailable' }],
    });

    expect(context.semanticEntities).toHaveLength(1);
    expect(context.semanticRelationships).toHaveLength(1);
    expect(context.contextObjects).toHaveLength(1);
  });
});
