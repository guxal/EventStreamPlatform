import { ContextObjectRepository } from './context-object.repository';

describe('ContextObjectRepository', () => {
  it('deduplicates context objects with nullable-safe lookup before insert', async () => {
    const now = new Date('2026-06-01');
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'ctx_1', project_id: 'project_1', context_type: 'UNAVAILABLE_METRIC_NOTE', title: 'Cost unavailable', content: 'No cost source.', source: 'appsflyer', report_type: null, entity_id: null, confidence: '1', valid_from: null, valid_to: null, is_system_generated: true, created_by: 'system', metadata_json: {}, created_at: now, updated_at: now }]),
    };
    const repository = new ContextObjectRepository(dataSource as never);

    await repository.upsertContextObject({ projectId: 'project_1', contextType: 'UNAVAILABLE_METRIC_NOTE', title: 'Cost unavailable', content: 'No cost source.', source: 'appsflyer' });

    expect(dataSource.query).toHaveBeenNthCalledWith(1, expect.stringContaining('IS NOT DISTINCT FROM'), expect.any(Array));
    expect(dataSource.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO context_objects'), expect.any(Array));
  });
});
