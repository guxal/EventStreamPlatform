import { SemanticEntityRepository } from './semantic-entity.repository';

describe('SemanticEntityRepository', () => {
  it('upserts entities by normalized canonical name and merges aliases/sources', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ id: 'entity_1', project_id: 'project_1', entity_type: 'campaign', canonical_name: 'campaign x', aliases: ['Campaign X'], sources: ['appsflyer'], metadata_json: {}, confidence: '1', created_at: new Date('2026-06-01'), updated_at: new Date('2026-06-01') }]),
    };
    const repository = new SemanticEntityRepository(dataSource as never);

    const entity = await repository.upsertEntity({ projectId: 'project_1', entityType: 'campaign', canonicalName: ' Campaign X ', aliases: ['Campaign X'], sources: ['AppsFlyer'] });

    expect(entity.canonicalName).toBe('campaign x');
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), expect.arrayContaining(['campaign x']));
  });
});
