import { DynamicMetricQueryService, DynamicMetricEntity } from './dynamic-metric-query.service';
import { DataSource } from 'typeorm';

describe('DynamicMetricQueryService', () => {
  let service: DynamicMetricQueryService;
  let dataSource: { query: jest.Mock } as unknown as DataSource;

  beforeEach(() => {
    dataSource = { query: jest.fn() } as any;
    service = new DynamicMetricQueryService(dataSource as unknown as DataSource);
  });

  it('builds query with parameters', () => {
    const def: DynamicMetricEntity = {
      table: 'events',
      aggregation: { field: 'amount', func: 'sum', alias: 'total' },
      conditions: [
        { column: 'user_id', operator: '=', paramKey: 'userId' },
        { column: 'created_at', operator: '>=', paramKey: 'from' },
      ],
    };
    const { sql, values } = service.buildQuery(def, { userId: 5, from: '2024-01-01' });
    expect(sql).toBe('SELECT SUM(amount) AS total FROM events WHERE user_id = $1 AND created_at >= $2');
    expect(values).toEqual([5, '2024-01-01']);
  });

  it('executes built query', async () => {
    const def: DynamicMetricEntity = {
      table: 'events',
      aggregation: { field: '*', func: 'count', alias: 'c' },
    };
    (dataSource.query as jest.Mock).mockResolvedValueOnce([{ c: 3 }]);
    const result = await service.execute(def, {});
    expect(result).toEqual([{ c: 3 }]);
    expect(dataSource.query).toHaveBeenCalledWith('SELECT COUNT(*) AS c FROM events', []);
  });
});
