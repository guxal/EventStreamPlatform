import { ContextBuilderService } from './context-builder.service';

describe('ContextBuilderService', () => {
  it('creates unavailable metric and data quality context from facts without raw CSV', async () => {
    const contextRepository = { upsertContextObject: jest.fn(async (input) => ({ id: input.title, ...input })) };
    const adapter = { source: 'appsflyer', buildContextObjects: jest.fn().mockResolvedValue([]) };
    const service = new ContextBuilderService(contextRepository as never, adapter as never);

    const result = await service.buildForImport({
      projectId: 'project_1',
      source: 'appsflyer',
      facts: [
        { entityId: 'project_1', entityType: 'account', factType: 'NO_RELIABLE_COST_SOURCE', severity: 'HIGH', confidence: 1, temporalContext: { lookbackDays: 1 }, metricsSummary: {} } as never,
        { entityId: 'project_1', entityType: 'account', factType: 'EVENT_REVENUE_EMPTY', severity: 'MEDIUM', confidence: 1, temporalContext: { lookbackDays: 1 }, metricsSummary: {} } as never,
      ],
    });

    expect(result.contextObjectsCreated).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(result.contextObjects).toLowerCase()).not.toContain('raw csv');
  });
});
