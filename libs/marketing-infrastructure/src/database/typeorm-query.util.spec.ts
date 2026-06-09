import { firstQueryRow, unwrapQueryRows } from './typeorm-query.util';

describe('typeorm-query.util', () => {
  const row = { id: '1', created_at: '2026-06-09T00:00:00.000Z' };

  it('unwraps SELECT/INSERT row arrays', () => {
    expect(unwrapQueryRows([row])).toEqual([row]);
  });

  it('unwraps UPDATE tuples returned by TypeORM', () => {
    expect(unwrapQueryRows([[row], 1])).toEqual([row]);
  });

  it('returns the first row from either shape', () => {
    expect(firstQueryRow([row])).toEqual(row);
    expect(firstQueryRow([[row], 1])).toEqual(row);
  });
});
