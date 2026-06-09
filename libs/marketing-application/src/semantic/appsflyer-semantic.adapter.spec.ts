import { AppsFlyerSemanticAdapter } from './appsflyer-semantic.adapter';

describe('AppsFlyerSemanticAdapter', () => {
  const repository = {
    getSemanticSeedEvents: jest.fn().mockResolvedValue([
      {
        mediaSource: 'googleadwords_int',
        campaignName: 'Campaign X',
        campaignId: '123',
        eventName: 'deposit_success',
        canonicalEventName: 'DEPOSIT',
        events: 10,
      },
    ]),
  };

  it('creates AppsFlyer semantic entities and conversion relationships', async () => {
    const adapter = new AppsFlyerSemanticAdapter(repository as never);
    const input = { projectId: 'project_1', source: 'appsflyer', reportType: 'non_organic_in_app_events', importId: 'import_1' };

    await expect(adapter.buildEntities(input)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'media_source', canonicalName: 'googleadwords_int' }),
        expect.objectContaining({ entityType: 'campaign', canonicalName: 'Campaign X' }),
        expect.objectContaining({ entityType: 'conversion_event', canonicalName: 'deposit_success' }),
        expect.objectContaining({ entityType: 'canonical_event', canonicalName: 'DEPOSIT' }),
      ]),
    );
    await expect(adapter.buildRelationships(input)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ relationshipType: 'CAMPAIGN_HAS_CONVERSION_EVENT' })]),
    );
  });
});
