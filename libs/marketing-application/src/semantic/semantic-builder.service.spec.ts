import { SemanticBuilderService } from './semantic-builder.service';

describe('SemanticBuilderService', () => {
  it('uses registered source adapter to upsert entities, relationships, and link facts', async () => {
    const entityRepository = { upsertEntity: jest.fn(async (input) => ({ id: `${input.entityType}:${input.canonicalName}`, ...input })) };
    const relationshipRepository = { upsertRelationship: jest.fn(async (input) => ({ id: input.relationshipType, ...input })) };
    const factRepository = { linkFactsToSemanticEntity: jest.fn().mockResolvedValue(3) };
    const adapter = {
      source: 'appsflyer',
      buildEntities: jest.fn().mockResolvedValue([
        { draftKey: 'campaign:1', entityType: 'campaign', canonicalName: 'campaign x' },
        { draftKey: 'conversion_event:deposit_success', entityType: 'conversion_event', canonicalName: 'deposit_success' },
      ]),
      buildRelationships: jest.fn().mockResolvedValue([{ sourceDraftKey: 'campaign:1', targetDraftKey: 'conversion_event:deposit_success', relationshipType: 'CAMPAIGN_HAS_CONVERSION_EVENT' }]),
    };
    const service = new SemanticBuilderService(entityRepository as never, relationshipRepository as never, factRepository as never, adapter as never);

    const result = await service.buildForImport({ projectId: 'project_1', source: 'appsflyer', importId: 'import_1' });

    expect(result.entitiesCreated).toBe(2);
    expect(result.relationshipsCreated).toBe(1);
    expect(result.factsLinked).toBe(3);
  });
});
