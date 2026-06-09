import { SemanticRelationshipRepository } from './semantic-relationship.repository';

describe('SemanticRelationshipRepository', () => {
  it('deduplicates relationships with nullable-safe lookup before insert', async () => {
    const now = new Date('2026-06-01');
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'rel_1', project_id: 'project_1', source_entity_id: 'source_1', target_entity_id: 'target_1', relationship_type: 'CAMPAIGN_HAS_EVENT', confidence: '1', source: 'appsflyer', report_type: null, import_id: null, raw_file_id: null, metadata_json: {}, created_at: now, updated_at: now }]),
    };
    const repository = new SemanticRelationshipRepository(dataSource as never);

    await repository.upsertRelationship({ projectId: 'project_1', sourceEntityId: 'source_1', targetEntityId: 'target_1', relationshipType: 'CAMPAIGN_HAS_EVENT', source: 'appsflyer' });

    expect(dataSource.query).toHaveBeenNthCalledWith(1, expect.stringContaining('IS NOT DISTINCT FROM'), expect.any(Array));
    expect(dataSource.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO semantic_relationships'), expect.any(Array));
  });
});
